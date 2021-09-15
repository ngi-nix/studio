{ version
, homepage
, downloadPage
, changelog
, maintainers
, platforms
, useWayland ? false
}:
{ lib
, electron
, eudev
, makeWrapper
, nix-filter
, nix-utils
, nodejs
, python3
, stdenv
, symlinkJoin
, ...
}@pkgs:

let
  inherit (builtins)
    concatStringsSep
    map
  ;
  inherit (lib)
    importJSON
    optionals
  ;
  inherit (stdenv) isLinux;
  inherit (nix-utils) getPatches;

  src = ./..;
  packageJson = importJSON "${toString src}/package.json";
  pname = packageJson.name;

  # Pass electron-builder symlinks to avoid unnecessary copies
  # Originally seen in https://github.com/NixOS/nixpkgs/pull/86169
  symlinkedElectron = symlinkJoin {
    name = "symlinked-electron";
    paths = [ electron.out ];
  };

  nm = import ./node_modules.nix {
    inherit src nodejs;
    electron = symlinkedElectron;
  } pkgs;
in

stdenv.mkDerivation {
  inherit pname version src;

  NO_UPDATE_NOTIFIER = 1;
  npm_config_runtime = "electron";
  npm_config_target = electron.version;
  npm_config_tarball = electron.headers;

  buildInputs = [ nm.out ];

  nativeBuildInputs = [
    makeWrapper.out
    python3.out
  ] ++ optionals isLinux [
    eudev.out   # libudev.h
  ];

  patches = getPatches ./patches;

  # TODO try to make it work with symlink
  preConfigure = ''
    cp --no-preserve=mode -r ${nm}/node_modules node_modules
    chmod -R u+rw node_modules
  '';

  buildPhase =
    let
      extraResources = import ./extra-resources { inherit lib; };

      createSymlink = target: linkName: "ln -s ${target} ${linkName}";
      symlinkEach = files:
        let
          lines = map ({ filename, storePath }: createSymlink storePath filename) files;
        in
        concatStringsSep "\n" lines;
    in
    ''
      extraResourcesPath="installation/extra-resources"
      mkdir -p $extraResourcesPath
      pushd $extraResourcesPath
      ${symlinkEach extraResources}
      popd

      packages_with_gyp="$(find ./node_modules -name "*.gyp" | awk -F'/' '{ if ($3 ~ /^@/) printf "%s/%s\n", $3, $4; else print $3 }' | grep -v "npm" | uniq | tr "\n" " ")"
      npm rebuild $packages_with_gyp

      npm run build

      npx --no-install electron-builder \
        --config.electronVersion="${electron.version}" \
        --config.electronDist="${symlinkedElectron}/lib/electron" \
        --dir
    '';

  installPhase =
    let
      electronExecutable =
        if stdenv.isDarwin then
          "${electron}/Applications/Electron.app/Contents/MacOS/Electron"
        else
          "${electron}/bin/electron"
        ;
    in
    ''
      mkdir -p $out/lib/${pname}
      resourcesDir=$out/lib/${pname}/resources

      mv ./dist/linux-unpacked/resources $resourcesDir

      mkdir -p $out/bin
      makeWrapper '${electronExecutable}' "$out/bin/${pname}" \
        --set ELECTRON_RESOURCES_PATH $resourcesDir \
        --add-flags "$resourcesDir/app.asar"
    '';

  meta = {
    description = packageJson.description;
    longDescription =
      "The EEZ Studio is an open source cross-platform modular visual tool" +
      "aimed to address various programming and management tasks for EEZ BB3" +
      "open source T&M chassis and EEZ H24005 programmable power supply and" +
      "other T&M devices that support SCPI from manufacturers such as" +
      "Keysight, Rigol, Siglent, etc.";

    inherit homepage downloadPage changelog;

    license = lib.licenses.gpl3Only;
    inherit maintainers platforms;
  };
}
