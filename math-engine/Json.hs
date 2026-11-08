module Json (Json(..), encode, decode, field, string, number,
             Parser(..), satisfy, char, eof) where

import Control.Applicative (Alternative(..))
import Control.Monad (ap, replicateM)
import Data.Char (chr, isSpace)
import Data.List (intercalate)
import Numeric (readHex, showHex)
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

-- | Our own parser monad. A parser is a function from the remaining input to
-- either failure ('Nothing') or a result plus the input it did not consume.
newtype Parser a = Parser { runParser :: String -> Maybe (a, String) }

instance Functor Parser where
  fmap f (Parser p) = Parser $ \s -> case p s of
    Nothing -> Nothing
    Just (a, rest) -> Just (f a, rest)

instance Applicative Parser where
  pure a = Parser $ \s -> Just (a, s)
  (<*>) = ap

-- | Bind runs the first parser, then feeds its result and leftover input to
-- the next one. Any failure stops the whole chain.
instance Monad Parser where
  Parser p >>= f = Parser $ \s -> case p s of
    Nothing -> Nothing
    Just (a, rest) -> runParser (f a) rest

-- | Ordered choice: try the left parser; only if it fails, try the right one
-- on the same input. 'many' and 'some' come free from this instance.
instance Alternative Parser where
  empty = Parser (const Nothing)
  Parser p <|> Parser q = Parser $ \s -> p s <|> q s

satisfy :: (Char -> Bool) -> Parser Char
satisfy ok = Parser $ \s -> case s of
  c : rest | ok c -> Just (c, rest)
  _ -> Nothing

char :: Char -> Parser Char
char c = satisfy (== c)

keyword :: String -> Parser String
keyword = traverse char

eof :: Parser ()
eof = Parser $ \s -> if null s then Just ((), s) else Nothing

between :: Parser open -> Parser close -> Parser a -> Parser a
between open close p = open *> p <* close

sepBy :: Parser a -> Parser sep -> Parser [a]
sepBy p sep = ((:) <$> p <*> many (sep *> p)) <|> pure []

decode :: String -> Maybe Json
decode s = fst <$> runParser (spaces *> value <* spaces <* eof) s

spaces :: Parser ()
spaces = () <$ many (satisfy isSpace)
symbol :: Char -> Parser Char
symbol c = spaces *> char c <* spaces

-- JSON values start with different characters, so trying the alternatives
-- in order never hides a valid parse.
value :: Parser Json
value = (Object <$> between (symbol '{') (symbol '}') (sepBy pair (symbol ',')))
    <|> (Array <$> between (symbol '[') (symbol ']') (sepBy value (symbol ',')))
    <|> (String <$> literal)
    <|> (Boolean True <$ keyword "true")
    <|> (Boolean False <$ keyword "false")
    <|> (Null <$ keyword "null")
    <|> numeric
  where
    pair = do
      k <- literal
      _ <- symbol ':'
      v <- value
      pure (k,v)
    numeric = do
      s <- some (satisfy (`elem` "-+0123456789.eE"))
      case readMaybe s of
        Just n | not (isNaN n || isInfinite n) -> pure (Number n)
        _ -> empty

literal :: Parser String
literal = spaces *> between (char '"') (char '"') (many charValue) <* spaces
  where
    charValue = satisfy (\c -> c /= '"' && c /= '\\' && c >= ' ')
      <|> (char '\\' *> escaped)
    escaped = ('"' <$ char '"') <|> ('\\' <$ char '\\') <|> ('/' <$ char '/')
      <|> ('\n' <$ char 'n') <|> ('\r' <$ char 'r') <|> ('\t' <$ char 't')
      <|> ('\b' <$ char 'b') <|> ('\f' <$ char 'f') <|> unicode
    unicode = do
      _ <- char 'u'
      digits <- replicateM 4 (satisfy (`elem` "0123456789abcdefABCDEF"))
      case readHex digits of
        [(n,"")] -> pure (chr n)
        _ -> empty
