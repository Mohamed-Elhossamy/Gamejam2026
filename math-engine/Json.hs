module Json (Json(..), encode, decode, field, string, number) where

import Data.Char (chr, isSpace)
import Data.List (intercalate)
import Numeric (readHex, showHex)
import Text.ParserCombinators.ReadP hiding (string)
import qualified Text.ParserCombinators.ReadP as P
import Text.Read (readMaybe)

data Json = Object [(String, Json)] | Array [Json] | String String
          | Number Double | Boolean Bool | Null deriving (Eq, Show)

field :: String -> Json -> Json
field key (Object pairs) = maybe Null id (lookup key pairs)
field _ _ = Null
string :: Json -> String
string (String s) = s
string _ = ""
number :: Json -> Double
number (Number n) = n
number _ = 0

encode :: Json -> String
encode (Object pairs) = "{" ++ intercalate "," [quote k ++ ":" ++ encode v | (k,v) <- pairs] ++ "}"
encode (Array xs) = "[" ++ intercalate "," (map encode xs) ++ "]"
encode (String s) = quote s
encode (Number n)
  | isNaN n || isInfinite n = "null"
  | n == fromInteger (round n) = show (round n :: Integer)
  | otherwise = show n
encode (Boolean b) = if b then "true" else "false"
encode Null = "null"

quote :: String -> String
quote s = "\"" ++ concatMap escape s ++ "\""
  where
    escape '"' = "\\\""
    escape '\\' = "\\\\"
    escape '\n' = "\\n"
    escape '\r' = "\\r"
    escape '\t' = "\\t"
    escape c | fromEnum c < 32 = "\\u" ++ replicate (4-length h) '0' ++ h
             | otherwise = [c]
      where h = showHex (fromEnum c) ""

decode :: String -> Maybe Json
decode s = case readP_to_S (spaces *> value <* spaces <* eof) s of
  [] -> Nothing
  xs -> Just (fst (last xs))

spaces :: ReadP ()
spaces = skipMany (satisfy isSpace)
symbol :: Char -> ReadP Char
symbol c = spaces *> char c <* spaces

value :: ReadP Json
value = (Object <$> between (symbol '{') (symbol '}') (sepBy pair (symbol ',')))
    +++ (Array <$> between (symbol '[') (symbol ']') (sepBy value (symbol ',')))
    +++ (String <$> literal)
    +++ (Boolean True <$ P.string "true")
    +++ (Boolean False <$ P.string "false")
    +++ (Null <$ P.string "null")
    +++ numeric
  where
    pair = do
      k <- literal
      _ <- symbol ':'
      v <- value
      pure (k,v)
    numeric = do
      s <- munch1 (`elem` "-+0123456789.eE")
      case readMaybe s of
        Just n | not (isNaN n || isInfinite n) -> pure (Number n)
        _ -> pfail

literal :: ReadP String
literal = spaces *> between (char '"') (char '"') (many charValue) <* spaces
  where
    charValue = satisfy (\c -> c /= '"' && c /= '\\' && c >= ' ')
      +++ (char '\\' *> escaped)
    escaped = choice [char '"' >> pure '"', char '\\' >> pure '\\', char '/' >> pure '/',
      char 'n' >> pure '\n', char 'r' >> pure '\r', char 't' >> pure '\t',
      char 'b' >> pure '\b', char 'f' >> pure '\f', unicode]
    unicode = do
      _ <- char 'u'
      digits <- count 4 (satisfy (`elem` "0123456789abcdefABCDEF"))
      case readHex digits of
        [(n,"")] -> pure (chr n)
        _ -> pfail
