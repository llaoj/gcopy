#!/bin/bash -e

VERSION=$(cat version.txt)

if [[ ! "${VERSION}" =~ ^v([0-9]+[.][0-9]+)[.]([0-9]+)(-(alpha|beta)[.]([0-9]+))?$ ]]; then
  echo "Version ${VERSION} must be 'X.Y.Z', 'X.Y.Z-alpha.N', or 'X.Y.Z-beta.N'"
  exit 1
fi

# if [ "$(git tag -l "${VERSION}")" ]; then
#   echo "Tag ${VERSION} already exists"
#   exit 1
# fi

git tag -f -a -m "Release ${VERSION}" "${VERSION}"
git push origin -f "${VERSION}"

echo "release_tag=refs/tags/${VERSION}"