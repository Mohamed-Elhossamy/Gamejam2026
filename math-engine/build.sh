#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p dist
ghc -O1 -threaded -rtsopts -Wall -i. -outputdir dist Main.hs -o dist/lambda-math
