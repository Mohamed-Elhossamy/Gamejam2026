module Main where
import Mathematics
import Json
import Control.Applicative ((<|>), empty)
import Control.Monad (unless, forM_)
import Data.Char (chr, isDigit, isSpace)
import Data.List (nub, isInfixOf)
import Numeric (readHex)
import Text.ParserCombinators.ReadP (ReadP, readP_to_S)
import qualified Text.ParserCombinators.ReadP as R
import Text.Read (readMaybe)

assert :: String -> Bool -> IO ()
assert message condition = unless condition (error message)
main :: IO ()
main = do
  assert "derivative" (differentiate [7,2,3,4] == [2,6,12])
  assert "gradient" (evaluate (differentiate [7,2,3,4]) 2 == 62)
  assert "vector sum" (vectorAdd [1,2] [3,4] == [4,6])
  assert "dot" (dotProduct [2,3] [4,5] == 23)
  forM_ (zip [0..6] ["128(2+8x)^{3}","11","34","72(1+6x)^{3}","3","y=\\sin(x)","\\cos^2(\\theta)"]) $ \(ordinal, answer) -> do
    let puzzle = makePuzzle 6 ordinal 42
    assert ("Level 6 correct answer " ++ show ordinal) (solution puzzle == answer)
    assert "Level 6 choices validated in Haskell" (length (filter (`equivalent` answer) (choices puzzle)) == 1)
    assert "supplementary checkpoints are unscored" (difficultyPoints puzzle == if ordinal >= 5 then 0 else 500)
  assert "chain derivative at zero" (slopeData (makePuzzle 6 0 1) == Just (0,1024))
  assert "new chain derivative at zero" (slopeData (makePuzzle 6 3 1) == Just (0,72))
  assert "supplied determinant" (determinant [[7,3],[-2,4]] == 34)
  forM_ [0, pi/6, pi/4, pi/3, pi/2, pi, 5*pi/3] $ \theta ->
    assert "squared trig identity" (abs (sin theta ^ (2::Int) + cos theta ^ (2::Int) - 1) < (1e-12::Double))
  assert "matrix multiplication" (multiply [[1,2],[3,4]] [[2,0],[1,2]] == [[4,4],[10,8]])
  assert "inverse" (inverse [[1,2],[3,7]] == Just [[7,-2],[-3,1]])
  assert "singular" (inverse [[1,2],[2,4]] == Nothing)
  assert "numeric equivalent" (equivalent "1/2" "0.5")
  assert "typeset fraction equivalent" (equivalent "\\frac{3}{4}" "3/4")
  assert "non-finite input" (not (equivalent "NaN" "2") && not (equivalent "Infinity" "2"))
  assert "JSON round trip" (decode (encode $ Object [("lambda",String "λ\n\\\""),("x",Number 2)]) == Just (Object [("lambda",String "λ\n\\\""),("x",Number 2)]))
  forM_ [1..25] $ \stage -> forM_ [0..19] $ \ordinal -> forM_ [1..12] $ \seed -> do
    let p = makePuzzle stage ordinal seed
    assert "four distinct choices" (length (choices p) == 4 && length (nub $ choices p) == 4)
    assert "one correct choice" (length (filter (`equivalent` solution p) (choices p)) == 1)
    assert "known mechanism" (mechanism p `elem` ["gear","vector","matrix"])
    assert "stationary points removed" (not ("stationary" `isInfixOf` prompt p) && topic p /= "Stationary points")
    assert "differentiation has physical effect" (mechanism p /= "gear" || case (slopeData p,motionData p) of (Just (_,g),_) -> g > 0; (_,Just (v,t)) -> v > 0 && t == 2; _ -> False)
  forM_ [1..30] $ \seed -> do
    let power = makePuzzle 1 0 seed
        a = toInteger (1 + seed `mod` 3)
        n = 2
    assert "power ramp matches derivative at one" (slopeData power == Just (1, a * toInteger n))
    assert "opening question has a clear purpose" (purposeFor (topic power) == "Find the derivative")
    assert "stage points follow difficulty" (difficultyPoints (makePuzzle 1 0 seed) == 100 && difficultyPoints (makePuzzle 5 0 seed) == 500)
    let motion = makePuzzle 2 2 seed
    assert "motion asks time derivative" (topic motion == "Velocity over time")
    assert "velocity and duration are exact" (motionData motion == Just (2*a + toInteger (1+(seed `div` 7) `mod` 3),2))
    assert "time derivative comes after beginner questions" (motionData (makePuzzle 1 1 seed) == Nothing)
    let vector = makePuzzle 3 0 seed
    assert "depth comes from true third component" (case vectorData vector of Just [_,_,z] -> z == 2; _ -> False)
    assert "vectors use column notation" ("\\begin{bmatrix}" `isInfixOf` prompt vector)
  forM_ [1..30] $ \seed -> do
    let easy = difficultyPoints (makePuzzle 1 0 seed)
        hard = difficultyPoints (makePuzzle 5 0 seed)
    assert "harder question awards more than easier one" (hard > easy)
  -- Time bonus rules, in plain and LaTeX forms.
  forM_ [ ("6",6), ("5x+12",12), ("5x",5), ("-12x+3",12), ("3/4",3), ("\\frac{3}{4}",3)
        , ("(7/2)x+2",7), ("\\frac{7}{2}x+2",7), ("2.5",3), ("-4.2",5), ("2.0",2)
        , ("(3,-7,2)",7), ("\\begin{bmatrix}3 \\\\ -7 \\\\ 2\\end{bmatrix}",7)
        , ("[[1,-9],[4,2]]",9), ("\\begin{bmatrix}1 & -9 \\\\ 4 & 2\\end{bmatrix}",9), ("x",0) ] $ \(answer, expected) ->
    assert ("time bonus " ++ answer) (timeBonus answer == (expected :: Integer))
  forM_ [1..25] $ \stage -> forM_ [0..19] $ \ordinal -> forM_ [1..12] $ \seed ->
    assert "time bonus is never negative" (timeBonus (solution (makePuzzle stage ordinal seed)) >= 0)
  forM_ [1..30] $ \seed -> forM_ [1,3,4] $ \ordinal ->
    assert "3D matrix families answer with a 3D vector"
      (case vectorData (makePuzzle 4 ordinal seed) of Just [_,_,_] -> True; _ -> False)
  -- Parser monad laws, checked on sample parsers, functions and inputs.
  let parsers = [char 'a', satisfy isDigit, 'k' <$ char 'b', empty, pure 'z']
      functions = [\c -> if c == 'a' then char 'b' else empty, pure . succ, char]
      inputs = ["", "a", "ab", "aab", "abc", "1a", "zz", "ba"]
      same p q = all (\i -> runParser p i == runParser q i) inputs
  forM_ "az1" $ \x -> forM_ functions $ \f ->
    assert "monad left identity" (same (pure x >>= f) (f x))
  forM_ parsers $ \m -> do
    assert "monad right identity" (same (m >>= pure) m)
    assert "alternative identity" (same (empty <|> m) m && same (m <|> empty) m)
    forM_ functions $ \f -> forM_ functions $ \g ->
      assert "monad associativity" (same ((m >>= f) >>= g) (m >>= (\x -> f x >>= g)))
  -- Differential test: our Parser monad must accept and reject exactly what
  -- the previous ReadP decoder did, on hand-picked, generated and mutated input.
  let handPicked = ["", " ", "{}", "[]", "[1,2", "{\"a\":1,}", "[1,]", "\"\\u00e9\"", "\"\\uZZZZ\"",
        "\"\\x\"", "1e400", "-", "1.", ".5", "+1", "  {\"a\" : [true,false,null, -1.5e3, \"x\\n\"]}  ",
        "nul", "truex", "\"tab\there\"", "{\"a\":1}{", "[[[[[]]]]]", "\"\955\"", "{\"a\" 1}",
        "{\"stage\":3,\"ordinal\":2,\"runKey\":\"abc\"}", "[1 2]", "{,}", "\"\\/\\b\\f\"", "1e5", "-0"]
      puzzles = [encode (publicPuzzle "lambda-0" stage (makePuzzle stage ordinal seed)) | stage <- [1..25], ordinal <- [0..19], seed <- [1..12]]
      alphabet = "{}[],:\"\\ 0123456789.eE-+tfnlu\955"
      mutate base k = let n = length base; r = (k * 1103515245 + 12345) `mod` 2147483648
                          i = if n == 0 then 0 else r `mod` n; c = alphabet !! (r `div` 7 `mod` length alphabet)
                      in case r `mod` 3 of
                           0 -> take i base ++ drop (i + 1) base
                           1 -> take i base ++ [c] ++ drop i base
                           _ -> take i base ++ [c] ++ drop (i + 1) base
      mutated = [mutate base (j * 7919 + length base) | base <- handPicked ++ take 300 puzzles, j <- [1..20]]
      corpus = handPicked ++ puzzles ++ mutated
  forM_ corpus $ \text -> assert ("parser matches ReadP on " ++ show text) (decode text == decodeReadP text)
  assert "differential corpus has both accepted and rejected input"
    (any ((== Nothing) . decode) corpus && any ((/= Nothing) . decode) corpus)
  putStrLn ("Haskell mathematics: pure operations, JSON, all stage families, time bonus rules and 6000 generated puzzles passed. Parser monad: laws hold and "
    ++ show (length corpus) ++ " inputs match the ReadP reference.")

-- The previous ReadP decoder, kept only as the reference for the differential test.
decodeReadP :: String -> Maybe Json
decodeReadP s = case readP_to_S (spacesR *> valueR <* spacesR <* R.eof) s of
  [] -> Nothing
  xs -> Just (fst (last xs))
  where
    spacesR = R.skipMany (R.satisfy isSpace)
    symbolR c = spacesR *> R.char c <* spacesR
    valueR :: ReadP Json
    valueR = (Object <$> R.between (symbolR '{') (symbolR '}') (R.sepBy pairR (symbolR ',')))
      R.+++ (Array <$> R.between (symbolR '[') (symbolR ']') (R.sepBy valueR (symbolR ',')))
      R.+++ (String <$> literalR)
      R.+++ (Boolean True <$ R.string "true")
      R.+++ (Boolean False <$ R.string "false")
      R.+++ (Null <$ R.string "null")
      R.+++ numericR
    pairR = do { k <- literalR; _ <- symbolR ':'; v <- valueR; pure (k,v) }
    numericR = do
      t <- R.munch1 (`elem` "-+0123456789.eE")
      case readMaybe t of
        Just n | not (isNaN n || isInfinite n) -> pure (Number n)
        _ -> R.pfail
    literalR = spacesR *> R.between (R.char '"') (R.char '"') (R.many charR) <* spacesR
    charR = R.satisfy (\c -> c /= '"' && c /= '\\' && c >= ' ') R.+++ (R.char '\\' *> escapedR)
    escapedR = R.choice [R.char '"' >> pure '"', R.char '\\' >> pure '\\', R.char '/' >> pure '/',
      R.char 'n' >> pure '\n', R.char 'r' >> pure '\r', R.char 't' >> pure '\t',
      R.char 'b' >> pure '\b', R.char 'f' >> pure '\f', unicodeR]
    unicodeR = do
      _ <- R.char 'u'
      digits <- R.count 4 (R.satisfy (`elem` "0123456789abcdefABCDEF"))
      case readHex digits of
        [(n,"")] -> pure (chr n)
        _ -> R.pfail
