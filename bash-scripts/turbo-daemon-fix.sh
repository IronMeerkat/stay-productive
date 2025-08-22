#!/bin/bash

# cd to /Users/ironmeerkat/athena/athena-browser-extension
cd /Users/ironmeerkat/athena/athena-browser-extension


# stop any running daemon
pnpx turbo daemon stop || true

# kill just in case (older turbo used 'kill')
# pnpx turbo daemon kill || true

# clear workspace cache
rm -rf .turbo node_modules/.cache/turbo

# clear user-level turbo caches (macOS)
rm -rf ~/Library/Caches/turbo || true

pnpx turbo daemon start

# cd to the original directory where we started
cd -