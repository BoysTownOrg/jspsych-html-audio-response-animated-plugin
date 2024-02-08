#!/bin/bash

set -eu

bun build volume-processor.ts --outdir dist/
rollup --config
