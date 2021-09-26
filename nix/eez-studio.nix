{ version
, homepage
, downloadPage
, changelog
, maintainers
, platforms
}:
{ lib
, electron
, makeWrapper
, nix-utils
, nodejs
, npmlock2nix
, stdenv
, symlinkJoin
, ...
}@pkgs:

let
  inherit (builtins)
    concatStringsSep
    map
  ;
  inherit (lib) importJSON;
  inherit (nix-utils) getPatches;
  inherit (npmlock2nix.internal) add_node_modules_to_cwd;

  src = ./..;
  packageJson = importJSON "${toString src}/package.json";
  pname = packageJson.name;
  mainProgram = pname;

  # Pass electron-builder symlinks to avoid unnecessary copies
  # Originally seen in https://github.com/NixOS/nixpkgs/pull/86169
  symlinkedElectron = symlinkJoin {
    name = "symlinked-electron";
    paths = [ electron.out ];
    passthru = { inherit (electron) version headers; };
  };

  nm = import ./node_modules.nix {
    inherit src nodejs;
    electron = symlinkedElectron;
  } pkgs;
in

stdenv.mkDerivation {
  inherit pname version src;

  NO_UPDATE_NOTIFIER = 1;

  buildInputs = [ nm.out ];

  nativeBuildInputs = [
    makeWrapper.out
  ];

  patches = getPatches ./patches;

  # couldn't make it work with symlink
  preConfigure = add_node_modules_to_cwd nm "copy";

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
      makeWrapper '${electronExecutable}' "$out/bin/${mainProgram}" \
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
    inherit maintainers mainProgram platforms;
  };
}
