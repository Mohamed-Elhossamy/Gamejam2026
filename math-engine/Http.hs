{-# LANGUAGE CPP, ForeignFunctionInterface #-}
module Http (serve) where

import Control.Concurrent (forkFinally)
import Control.Exception (bracket, try, SomeException)
import Control.Monad (forever, void, when)
import qualified Data.ByteString as B
import qualified Data.ByteString.Char8 as C
import Data.Char (toLower)
import Data.List (find, isPrefixOf)
import qualified Data.Text as T
import qualified Data.Text.Encoding as T
import Foreign hiding (void)
import Foreign.C
import Json (Json(..), encode, decode)
import System.IO (hPutStrLn, stderr)
import Text.Read (readMaybe)

foreign import ccall safe "socket" c_socket :: CInt -> CInt -> CInt -> IO CInt
foreign import ccall safe "bind" c_bind :: CInt -> Ptr a -> CUInt -> IO CInt
foreign import ccall safe "listen" c_listen :: CInt -> CInt -> IO CInt
foreign import ccall safe "accept" c_accept :: CInt -> Ptr a -> Ptr b -> IO CInt
foreign import ccall safe "recv" c_recv :: CInt -> Ptr a -> CSize -> CInt -> IO CLong
foreign import ccall safe "send" c_send :: CInt -> Ptr a -> CSize -> CInt -> IO CLong
foreign import ccall unsafe "close" c_close :: CInt -> IO CInt
foreign import ccall unsafe "setsockopt" c_setsockopt :: CInt -> CInt -> CInt -> Ptr a -> CUInt -> IO CInt

-- Socket constants and sockaddr_in layout differ between Linux and macOS.
solSocket, soReuseAddr, msgNoSignal :: CInt
#if defined(darwin_HOST_OS)
solSocket = 0xffff
soReuseAddr = 4
msgNoSignal = 0 -- macOS has no MSG_NOSIGNAL; GHC's runtime already ignores SIGPIPE.
#else
solSocket = 1
soReuseAddr = 2
msgNoSignal = 16384
#endif

-- A deliberately small, bounded HTTP/1.1 server, using libc sockets and GHC's
-- standard libraries only. No runtime package downloads or interpreter fallback.
serve :: Int -> (String -> String -> Json -> IO (Int, Json)) -> IO ()
serve port handler = bracket open (void . c_close) $ \socket -> do
  hPutStrLn stderr ("Lambda Haskell mathematics HTTP server ready on " ++ show port)
  forever $ do
    client <- c_accept socket nullPtr nullPtr
    when (client >= 0) $ void $ forkFinally (connection client) (const $ void $ c_close client)
  where
    open = do
      socket <- c_socket 2 1 0
      when (socket < 0) (ioError $ userError "socket failed")
      with (1 :: CInt) $ \p -> void (c_setsockopt socket solSocket soReuseAddr p 4)
      result <- allocaBytes 16 $ \address -> do
        fillBytes address 0 16
#if defined(darwin_HOST_OS)
        pokeByteOff address 0 (16 :: Word8) -- sin_len
        pokeByteOff address 1 (2 :: Word8)  -- sin_family = AF_INET
#else
        pokeByteOff address 0 (2 :: CUShort) -- sin_family = AF_INET
#endif
        -- Port and address in network byte order, written byte by byte.
        pokeByteOff address 2 (fromIntegral (port `div` 256) :: Word8)
        pokeByteOff address 3 (fromIntegral (port `mod` 256) :: Word8)
        -- Bind the private child server to loopback (127.0.0.1), not the public interface.
        pokeArray (address `plusPtr` 4) [127, 0, 0, 1 :: Word8]
        c_bind socket address 16
      when (result < 0) $ void (c_close socket) >> ioError (userError "math port bind failed")
      ready <- c_listen socket 64
      when (ready < 0) $ void (c_close socket) >> ioError (userError "listen failed")
      pure socket
    connection client = do
      result <- try (readRequest client) :: IO (Either SomeException (String,String,Json))
      (status, payload) <- case result of
        Left _ -> pure (400,Object [("error",String "Malformed or oversized request")])
        Right (method,path,body) -> do
          response <- try (handler method path body) :: IO (Either SomeException (Int,Json))
          pure $ either (const (500,Object [("error",String "Mathematics engine failure")])) id response
      let body = T.encodeUtf8 (T.pack $ encode payload)
          header = C.pack $ "HTTP/1.1 " ++ show status ++ " " ++ reason status
            ++ "\r\nContent-Type: application/json; charset=utf-8\r\nConnection: close"
            ++ "\r\nCache-Control: no-store\r\nContent-Length: " ++ show (B.length body) ++ "\r\n\r\n"
      sendAll client (header <> body)
    reason 200 = "OK"
    reason 404 = "Not Found"
    reason 400 = "Bad Request"
    reason _ = "Internal Server Error"

readChunk :: CInt -> IO B.ByteString
readChunk client = allocaBytes 4096 $ \buffer -> do
  countBytes <- c_recv client buffer 4096 0
  if countBytes <= 0 then pure B.empty else B.packCStringLen (castPtr buffer, fromIntegral countBytes)

readRequest :: CInt -> IO (String,String,Json)
readRequest client = headers B.empty
  where
    headers acc = do
      when (B.length acc > 16384) (ioError $ userError "Request too large")
      case B.breakSubstring (C.pack "\r\n\r\n") acc of
        (headBytes,tailBytes) | not (B.null tailBytes) -> do
          let ls = lines (C.unpack headBytes)
              first = words (if null ls then "" else head ls)
              lengths = find (isPrefixOf "content-length:" . map toLower) ls
              len = maybe 0 (maybe (-1) id . readMaybe . drop 15) lengths :: Int
          when (len < 0 || len > 8192 || length first < 2) (ioError $ userError "Invalid request")
          bodyBytes <- body len (B.drop 4 tailBytes)
          parsed <- if len == 0 then pure Null else case T.decodeUtf8' bodyBytes of
            Left _ -> ioError (userError "Invalid UTF8")
            Right txt -> maybe (ioError $ userError "Invalid JSON") pure (decode $ T.unpack txt)
          pure (head first, takeWhile (/= '?') (first !! 1), parsed)
        _ -> do
          more <- readChunk client
          when (B.null more) (ioError $ userError "Incomplete request")
          headers (acc <> more)
    body len acc
      | B.length acc >= len = pure (B.take len acc)
      | otherwise = do
          more <- readChunk client
          when (B.null more) (ioError $ userError "Incomplete body")
          body len (acc <> more)

sendAll :: CInt -> B.ByteString -> IO ()
sendAll client bytes = B.useAsCStringLen bytes $ \(ptr,len) -> send ptr len
  where
    send _ 0 = pure ()
    send ptr len = do
      sent <- c_send client ptr (fromIntegral len) msgNoSignal
      when (sent <= 0) (ioError $ userError "Client disconnected")
      send (ptr `plusPtr` fromIntegral sent) (len - fromIntegral sent)
