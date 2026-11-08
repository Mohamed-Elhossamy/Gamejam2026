module Main where

import Control.Concurrent.MVar
import qualified Data.Map.Strict as Map
import Data.Time.Clock.POSIX (getPOSIXTime)
import Data.List (foldl')
import Http
import Json
import Mathematics
import System.Environment (getArgs)

data Stored = Stored Puzzle Bool (Map.Map String Json)
data Store = Store Int (Map.Map String Stored) (Map.Map String String) 

main :: IO ()
main = do
  args <- getArgs
  let port = if null args then 8091 else read (head args)
  initial <- floor . (*1000) <$> getPOSIXTime
  state <- newMVar (Store initial Map.empty Map.empty)
  serve port $ \method path body -> case (method,path) of
    ("GET","/math/health") -> pure (200,Object [("status",String "haskell-ready")])
    ("POST","/math/question") -> modifyMVar state $ \s@(Store counter puzzles keys) -> do
      let stage = round $ number $ field "stage" body
          ordinal = round $ number $ field "ordinal" body
          runKey = string $ field "runKey" body
          key = runKey ++ ":" ++ show stage ++ ":" ++ show ordinal
      if stage < 1 || stage > 100000 || ordinal < 0 || ordinal > 1000000 || null runKey || length runKey > 80
        then pure (s,(400,Object [("error",String "Invalid stage, ordinal, or run key")]))
        else case Map.lookup key keys >>= (\ident -> fmap (\p -> (ident,p)) (Map.lookup ident puzzles)) of
          Just (ident,Stored p _ _) -> pure (s,(200,publicPuzzle ident stage p))
          Nothing -> do
            let ident = "lambda-" ++ show counter
                seed = abs $ foldl' (\h c -> (h*33 + fromEnum c) `mod` 10000019) counter key
                p = makePuzzle stage ordinal seed
                -- Limit memory; old abandoned runs can be safely reissued.
                keep = if Map.size puzzles >= 2048 then Map.empty else puzzles
                keepKeys = if Map.size puzzles >= 2048 then Map.empty else keys
                next = Store (counter+1) (Map.insert ident (Stored p False Map.empty) keep) (Map.insert key ident keepKeys)
            pure (next,(200,publicPuzzle ident stage p))
    ("POST","/math/answer") -> modifyMVar state $ \s@(Store counter puzzles keys) -> do
      let ident = string $ field "questionId" body
          answer = string $ field "answer" body
          attempt = string $ field "attemptId" body
      if null attempt || null answer || length answer > 300 || length attempt > 160
        then pure (s,(400,Object [("error",String "Invalid answer or attempt")]))
        else case Map.lookup ident puzzles of
          Nothing -> pure (s,(404,Object [("error",String "Puzzle expired; reconnect to request it again")]))
          Just (Stored p solved attempts) -> case Map.lookup attempt attempts of
            Just result -> pure (s,(200,result))
            Nothing -> do
              let correct = equivalent answer (solution p)
                  newlySolved = correct && not solved
                  result = Object [("questionId",String ident),("attemptId",String attempt),
                    ("correct",Boolean correct),("solved",Boolean (solved || correct)),
                    -- Awarded once per puzzle: a repeated or later attempt adds no extra time.
                    ("timeBonus",Number $ if newlySolved && difficultyPoints p > 0 then fromIntegral (timeBonus (solution p)) else 0),
                    ("points",Number $ if newlySolved then fromIntegral (difficultyPoints p) else 0),
                    ("effect",if solved || correct then slopeEffect p else Null),
                    ("feedback",String $ if correct then "Correct. Mechanism activated — run!"
                      else "WRONG")]
                  attempts' = Map.insert attempt result (if Map.size attempts > 64 then Map.empty else attempts)
                  next = Store counter (Map.insert ident (Stored p (solved || correct) attempts') puzzles) keys
              pure (next,(200,result))
    _ -> pure (404,Object [("error",String "Unknown math route")])
