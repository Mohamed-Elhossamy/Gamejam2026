module Mathematics where

import Data.Char (isDigit, isSpace, toLower)
import Data.List (nub, stripPrefix)
import Data.Ratio ((%), numerator, denominator)
import Json
import Text.Read (readMaybe)

type Matrix = [[Rational]]
type Vector = [Rational]
type Polynomial = [Integer] -- ascending powers

differentiate :: Polynomial -> Polynomial
differentiate = zipWith (*) [1..] . drop 1
evaluate :: Polynomial -> Integer -> Integer
evaluate coefficients x = sum $ zipWith (\a n -> a * x^n) coefficients [0 :: Int ..]
vectorAdd :: Vector -> Vector -> Vector
vectorAdd = zipWith (+)
vectorScale :: Rational -> Vector -> Vector
vectorScale k = map (k*)
dotProduct :: Vector -> Vector -> Rational
dotProduct a b = sum (zipWith (*) a b)
multiply :: Matrix -> Matrix -> Matrix
multiply a b = [[sum (zipWith (*) row [r !! col | r <- b]) | col <- [0..length (head b)-1]] | row <- a]
transform :: Matrix -> Vector -> Vector
transform m v = map (`dotProduct` v) m
determinant :: Matrix -> Rational
determinant [[a,b],[c,d]] = a*d-b*c
determinant _ = error "Only 2x2 matrices are supported"
inverse :: Matrix -> Maybe Matrix
inverse m@[[a,b],[c,d]]
  | det /= 0 = Just (map (map (/det)) [[d,-b],[-c,a]])
  | otherwise = Nothing
  where det = determinant m
inverse _ = Nothing

data Puzzle = Puzzle {
  topic :: String, prompt :: String, choices :: [String],
  solution :: String, mechanism :: String, hint :: String,
  slopeData :: Maybe (Integer, Integer),
  motionData :: Maybe (Integer, Integer),
  vectorData :: Maybe Vector,
  difficultyPoints :: Integer
} deriving Show

fmt :: Rational -> String
fmt r | denominator r == 1 = show (numerator r)
      | otherwise = "\\frac{" ++ show (numerator r) ++ "}{" ++ show (denominator r) ++ "}"
vec :: Vector -> String
vec xs = "\\begin{bmatrix}" ++ join " \\\\ " (map fmt xs) ++ "\\end{bmatrix}"
mat :: Matrix -> String
mat rows = "\\begin{bmatrix}" ++ join " \\\\ " (map (join " & " . map fmt) rows) ++ "\\end{bmatrix}"
join :: String -> [String] -> String
join _ [] = ""
join _ [x] = x
join s (x:xs) = x ++ s ++ join s xs

poly :: Polynomial -> String
poly as = case filter (not . null) [term a n | (a,n) <- reverse $ zip as [0 :: Int ..]] of
  [] -> "0"
  xs -> join " + " xs
  where
    term 0 _ = ""
    term a 0 = show a
    term a 1 = coefficient a ++ "x"
    term a n = coefficient a ++ "x^" ++ show n
    coefficient 1 = ""
    coefficient (-1) = "-"
    coefficient a = show a

normalise :: String -> String
normalise = map (\c -> if c == '−' then '-' else toLower c) . filter (not . isSpace)

equivalent :: String -> String -> Bool
equivalent a b = normalise a == normalise b || case (rational (normalise a), rational (normalise b)) of
  (Just x, Just y) -> x == y
  _ -> False
  where
    rational text = case break (=='/') (filter (not . isSpace) text) of
      (n,'/':d) -> do
        top <- readMaybe n :: Maybe Integer
        bottom <- readMaybe d :: Maybe Integer
        if bottom == 0 then Nothing else Just (top % bottom)
      (n,[]) -> case readMaybe n :: Maybe Double of
        Just value | not (isNaN value || isInfinite value) -> Just (toRational value)
        _ -> teXFraction n
      _ -> Nothing
    teXFraction text = do
      rest <- stripPrefix "\\frac{" text
      let (topText, topSuffix) = break (=='}') rest
      afterTop <- stripPrefix "}{" topSuffix
      let (bottomText, bottomSuffix) = break (=='}') afterTop
      if bottomSuffix /= "}" then Nothing else do
        top <- readMaybe topText :: Maybe Integer
        bottom <- readMaybe bottomText :: Maybe Integer
        if bottom == 0 then Nothing else Just (top % bottom)

makePuzzle :: Int -> Int -> Int -> Puzzle
makePuzzle stage ordinal seed = shuffle seed (raw {
  difficultyPoints = if stage == 6 && selectedOrdinal `mod` 7 >= 5 then 0 else 100 * toInteger (min 5 (max 1 selectedStage))
  })
  where
    selectedStage = if stage <= 6 then stage else 1 + seed `mod` 5
    selectedOrdinal = if stage <= 6 then ordinal else seed `div` 5
    a = toInteger (if stage <= 3 then 1 + seed `mod` 3 else 2 + seed `mod` 4)
    b = toInteger (1 + (seed `div` 7) `mod` 3)
    n = if stage <= 2 then 2 else 2 + (seed `div` 11) `mod` 3
    ar = fromInteger a
    br = fromInteger b
    scalar name question answer wrongs kind clue =
      Puzzle name question (take 4 $ nub $ answer : wrongs) answer kind clue Nothing Nothing Nothing 0
    slope point value puzzle = puzzle {
      slopeData = Just (point,value),
      hint = hint puzzle ++ " Your derivative at x = " ++ show point ++ " sets the ramp rise for one unit of horizontal travel."
    }
    timed velocity duration puzzle = puzzle {
      motionData = Just (velocity,duration),
      hint = hint puzzle ++ " The lift then uses this constant velocity for " ++ show duration ++ " seconds; displacement = velocity × time."
    }
    numeric name question answer kind clue = scalar name question (fmt answer)
      (map (fmt . (answer+)) [1,-1,2,3]) kind clue
    vectorPuzzle name question answer kind clue =
      (scalar name question (vec answer)
        [vec (map negate answer),vec (map (+1) answer),vec (map (+2) answer),vec (map (+3) answer)] kind clue)
        { vectorData = if length answer == 3 then Just answer else Nothing }
    matrixPuzzle name question answer clue =
      scalar name question (mat answer)
        [mat (map (map (+k)) answer) | k <- [1,-1,2,3]] "matrix" clue
    raw = case selectedStage of
      1 -> case selectedOrdinal `mod` 3 of
        0 -> let coefficients = [0,0,a]
                 correct = poly $ differentiate coefficients
             in slope 1 (evaluate (differentiate coefficients) 1) $ scalar "Power rule"
               ("f(x)=" ++ poly coefficients)
               correct [poly (replicate (n-1) 0 ++ [a]),poly (replicate n 0 ++ [a * toInteger n]),
                 poly (replicate (n-1) 0 ++ [a * toInteger (n+1)])] "gear" "Multiply by the power, then reduce the power by one."
        1 -> let p = [0,b,1]
             in slope 1 (evaluate (differentiate p) 1) $ scalar "Quadratic differentiation"
               ("f(x)=" ++ poly p) (poly $ differentiate p)
               [poly [b,1],poly [b+1,2],poly [b,3]]
               "gear" "Differentiate one term at a time."
        _ -> let p = [0,0,a]
             in slope 1 (evaluate (differentiate p) 1) $ numeric "Simple gradients"
               ("f(x)=" ++ poly p)
               (fromInteger $ evaluate (differentiate p) 1) "gear" "Differentiate, then substitute x = 1."
      2 -> case selectedOrdinal `mod` 3 of
        0 -> let inner = "(" ++ show a ++ "x+" ++ show b ++ ")"
                 expression k power = show k ++ inner ++ (if power == 1 then "" else "^" ++ show power)
             in slope 1 (toInteger n*a*(a+b)^(n-1)) $ scalar "Chain rule" ("f(x)=" ++ inner ++ "^" ++ show n)
               (expression (toInteger n*a) (n-1))
               [expression (toInteger n) (n-1),expression a (n-1),expression (toInteger n*a) n,
                 expression (toInteger (n+1)*a) (n-1),expression (toInteger n*a) (n+1)]
               "gear" "Differentiate the outer power and multiply by the derivative of the inner function."
        1 -> let p = [0,b,1]
             in slope 1 (evaluate (differentiate p) 1) $ scalar "Product rule" ("f(x)=x(x+" ++ show b ++ ")")
               (poly $ differentiate p) [poly [b,1],poly [b+1,2],poly [b,3]]
               "gear" "Use u'v + uv', or expand the product before differentiating."
        _ -> let velocity = 2*a+b
             in timed velocity 2 $ numeric "Velocity over time"
               ("s(t)=" ++ (if a == 1 then "" else show a) ++ "t^2+" ++ (if b == 1 then "" else show b) ++ "t")
               (fromInteger velocity) "gear" "Differentiate position, then substitute t = 1."
      3 -> case selectedOrdinal `mod` 4 of
        0 -> vectorPuzzle "Vector addition" (vec [ar,br,1] ++ "+" ++ vec [br,ar,1])
               (vectorAdd [ar,br,1] [br,ar,1]) "vector" "Add all three corresponding components. The third component moves the bridge in z."
        1 -> vectorPuzzle "Scalar multiplication" (show a ++ "\\times" ++ vec [br,-2,1])
               (vectorScale ar [br,-2,1]) "vector" "Multiply every component by the scalar. The third component controls depth."
        2 -> numeric "Vector magnitude" ("\\left\\|" ++ vec [br,2*br,2*br] ++ "\\right\\|")
               (3*br) "vector" "Use the square root of the sum of the three squared components."
        _ -> numeric "Dot products" (vec [ar,br,1] ++ "\\cdot" ++ vec [2,-1,3])
               (dotProduct [ar,br,1] [2,-1,3]) "vector" "Multiply all three corresponding components, then add."
      4 -> case selectedOrdinal `mod` 5 of
        0 -> let m = [[1,ar],[0,1]]; k = [[1,0],[br,1]]
             in matrixPuzzle "Matrix multiplication" (mat m ++ mat k)
               (multiply m k) "Multiply each row of the first matrix by each column of the second."
        1 -> let m = [[1,ar,0],[0,1,0],[br,0,1]]
             in vectorPuzzle "Matrix-vector transformations" (mat m ++ vec [2,1,1])
               (transform m [2,1,1]) "matrix" "Take the dot product of each row of the 3×3 matrix with the vector."
        2 -> numeric "Determinants" ("\\det" ++ mat [[ar,1],[br,2]])
               (determinant [[ar,1],[br,2]]) "matrix" "For a 2×2 matrix, determinant = ad − bc."
        -- 3D section: rotations and reflections act on 3D vectors so the answer
        -- also places the platform in depth (z).
        3 -> let m = [[0,-1,0],[1,0,0],[0,0,1]]
             in vectorPuzzle "Rotations" (mat m ++ vec [ar,br,1])
               (transform m [ar,br,1]) "matrix" "A 90° anticlockwise rotation about the z-axis sends (x,y,z) to (−y,x,z)."
        _ -> let m = [[1,0,0],[0,-1,0],[0,0,1]]
             in vectorPuzzle "Reflections" (mat m ++ vec [ar,br,1])
               (transform m [ar,br,1]) "matrix" "Reflection in the plane y = 0 changes only the sign of y."
      6 -> case selectedOrdinal `mod` 7 of
        0 -> chainChallenge 4 2 8 4
        1 -> dotChallenge [3,4] [5,-1]
        2 -> scalar "Level 6 determinant"
               ("A=" ++ mat [[7,3],[-2,4]] ++ ",\\quad \\det(A)=?")
               (fmt $ determinant [[7,3],[-2,4]]) ["22","28","-34"]
               "matrix" "The determinant is 7 × 4 − 3 × (−2), an area scale factor of 34."
        3 -> chainChallenge 3 1 6 4
        4 -> dotChallenge [2,5] [4,-1]
        5 -> scalar "Sine terrain" "y=\\;?"
               "y=\\sin(x)" ["y=\\cos(x)","y=x^2","y=1"]
               "matrix" "A supplementary terrain checkpoint: choosing sine reshapes the actual running surface."
        _ -> scalar "Trigonometric identity" "\\sin^2(\\theta)+\\boxed{\\phantom{\\cos^2(\\theta)}}=1"
               "\\cos^2(\\theta)" ["\\sin(\\theta)","\\cos(\\theta)","2\\cos(\\theta)"]
               "matrix" "The squared sine and squared cosine add to one, flattening the terrain."
      _ -> case selectedOrdinal `mod` 5 of
        0 -> let m = [[1,ar],[0,1]]; k = [[1,0],[br,1]]
                 result = zipWith (zipWith (-)) (multiply m k) (multiply k m)
             in matrixPuzzle "Matrix commutators" ("AB-BA,\\quad A=" ++ mat m ++ ",\\quad B=" ++ mat k)
               result "Compute both products in order; matrix multiplication is not commutative."
        1 -> let m = [[1,br],[ar,1+ar*br]]
             in matrixPuzzle "Inverse matrices" (mat m ++ "^{-1}")
               (maybe [] id $ inverse m) "Swap the diagonal entries, negate the others, and divide by the determinant."
        2 -> scalar "Eigenvalues" ("\\lambda\\in\\operatorname{spec}" ++ mat [[ar,br],[0,ar+2]])
               (vec [ar,ar+2]) [vec [ar+1,ar+3],vec [ar,br],vec [-ar,-ar-2],vec [ar+2,ar+4]]
               "matrix" "The eigenvalues of a triangular matrix are its diagonal entries."
        3 -> scalar "Eigenvectors" ("(A-" ++ show a ++ "I)v=0,\\quad A=" ++ mat [[ar,br],[0,ar+2]])
               (vec [1, 0]) [vec [0, 1],vec [1, 1],vec [0, 0]] "matrix" "Solve (A − λI)v = 0. An eigenvector must be nonzero."
        _ -> numeric "Vector spaces"
               ("\\dim\\operatorname{span}\\left\\{" ++ vec [1,0,1] ++ "," ++ vec [0,1,1] ++ "," ++ vec [1,1,2] ++ "\\right\\}")
               2 "vector" "The third vector is the sum of the first two independent vectors."
    chainChallenge outer constant inner power =
      let base = "(" ++ show constant ++ "+" ++ show inner ++ "x)"
          expression coefficient exponent = show coefficient ++ base ++ "^{" ++ show exponent ++ "}"
          coefficient = outer * power * inner
      in slope 0 (coefficient * constant^(power-1)) $
         scalar "Level 6 chain rule" ("f(x)=" ++ expression outer power)
           (expression coefficient (power-1))
           [expression (outer*power) (power-1), expression coefficient power, expression (outer*inner) (power-1)]
           "gear" "Differentiate the outer power and multiply by the derivative of the inner function."
    dotChallenge u v =
      (numeric "Level 6 dot product"
        ("\\mathbf a=" ++ vec u ++ ",\\quad \\mathbf c=" ++ vec v ++ ",\\quad \\mathbf a\\cdot\\mathbf c=?")
        (dotProduct u v) "vector" "Multiply matching components and add; the result activates the horizontal pathway.")
        { vectorData = Just [dotProduct u v,0,0] }

shuffle :: Int -> Puzzle -> Puzzle
shuffle seed p = p { choices = rotated }
  where
    xs = if even seed then choices p else reverse (choices p)
    k = seed `mod` length xs
    rotated = drop k xs ++ take k xs

publicPuzzle :: String -> Int -> Puzzle -> Json
publicPuzzle ident stage p = Object [
  ("id",String ident),("stage",Number $ fromIntegral stage),("topic",String $ topic p),
  ("purpose",String $ purposeFor $ topic p),
  ("prompt",String $ prompt p),("choices",Array $ map String $ choices p),
  ("mechanism",String $ mechanism p),("explanationHint",String $ hint p),
  ("mechanic",String $ case motionData p of Just _ -> "motion"; Nothing -> case slopeData p of Just _ -> "slope"; Nothing -> mechanism p),
  ("dimensions",Number $ if stage >= 3 && stage /= 6 then 3 else 2),
  ("points",Number $ fromIntegral $ difficultyPoints p)]

purposeFor :: String -> String
purposeFor name = case name of
  "Power rule" -> "Find the derivative"
  "Quadratic differentiation" -> "Find the derivative"
  "Velocity over time" -> "Find the velocity at t = 1"
  "Simple gradients" -> "Find the gradient at x = 1"
  "Chain rule" -> "Find the derivative"
  "Level 6 chain rule" -> "Differentiate with respect to x"
  "Level 6 dot product" -> "Calculate the scalar product"
  "Level 6 determinant" -> "Calculate the determinant"
  "Sine terrain" -> "Which function represents a sine wave?"
  "Trigonometric identity" -> "Complete the identity"
  "Product rule" -> "Find the derivative"
  "Vector addition" -> "Add the vectors"
  "Scalar multiplication" -> "Multiply the vector by the scalar"
  "Vector magnitude" -> "Find the vector magnitude"
  "Dot products" -> "Find the dot product"
  "Matrix multiplication" -> "Multiply the matrices"
  "Matrix-vector transformations" -> "Apply the matrix to the vector"
  "Determinants" -> "Find the determinant"
  "Rotations" -> "Apply the rotation matrix"
  "Reflections" -> "Apply the reflection matrix"
  "Matrix commutators" -> "Find AB − BA"
  "Inverse matrices" -> "Find the inverse matrix"
  "Eigenvalues" -> "Find the eigenvalues"
  "Eigenvectors" -> "Find an eigenvector"
  "Vector spaces" -> "Find the dimension of the span"
  _ -> "Calculate the result"

-- Reveal the actual mathematical effect only after a successful answer.
slopeEffect :: Puzzle -> Json
slopeEffect p = case (motionData p, vectorData p, slopeData p) of
  (Just (velocity,duration),_,_) -> Object [
    ("kind",String "motion"),("velocity",Number $ fromIntegral velocity),
    ("duration",Number $ fromIntegral duration)]
  (_,Just displacement,_) -> Object [
    ("kind",String "vector"),("displacement",Array $ map (Number . fromRational) displacement)]
  (_,_,Nothing) -> Null
  (_,_,Just (point, gradient)) -> Object [
    ("kind",String "slope"),("atX",Number $ fromIntegral point),
    ("gradient",Number $ fromIntegral gradient)]

-- | Seconds added to the run timer for a correct answer: the largest number
-- appearing in the canonical answer. Signs are ignored, a fraction counts only
-- its numerator (both @a/b@ and @\frac{a}{b}@), decimals round up, and vectors
-- and matrices use their largest entry. An answer with no digits gives 0.
timeBonus :: String -> Integer
timeBonus = maximum . (0 :) . scan
  where
    scan [] = []
    scan s@(c : cs)
      | Just rest <- stripPrefix "\\frac{" s =
          let (top, afterTop) = break (== '}') rest
          in scan top ++ scan (skipGroup (drop 1 afterTop))
      | isDigit c =
          let (token, rest) = span (\x -> isDigit x || x == '.') s
          in roundUp token : scan (skipDenominator rest)
      | otherwise = scan cs
    skipGroup ('{' : r) = drop 1 (dropWhile (/= '}') r)
    skipGroup r = r
    skipDenominator ('/' : r) = dropWhile (\x -> isDigit x || x == '.') r
    skipDenominator r = r
    roundUp token =
      let (whole, fraction) = break (== '.') token
          base = if null whole then 0 else read whole
      in if any (`notElem` "0.") (drop 1 fraction) then base + 1 else base
