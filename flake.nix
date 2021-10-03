{
  description = "Cross-platform visual development tool and SCPI instrument controller";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-21.05";
    flake-utils.url = "github:numtide/flake-utils";
    npmlock2nix = {
      url = "github:ilkecan/npmlock2nix/";
      flake = false;
    };
    nix-utils.url = "git+https://git.sr.ht/~ilkecan/nix-utils";
    source = {
      url = "github:eez-open/studio";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, flake-utils, npmlock2nix, ... }@inputs:
    let
      inherit (builtins)
        attrNames
        attrValues
      ;
      inherit (nixpkgs.lib)
        getAttrs
      ;
      inherit (flake-utils.lib)
        defaultSystems
        eachSystem
      ;
      nix-utils = inputs.nix-utils.lib;
      inherit (nix-utils)
        createOverlays
        getUnstableVersion
      ;

      supportedSystems = defaultSystems;
      commonArgs = {
        source = inputs.source.outPath;
        version = getUnstableVersion self.lastModifiedDate;
        homepage = "https://github.com/eez-open/studio";
        downloadPage = "https://github.com/eez-open/studio/releases";
        changelog = null;
        maintainers = [
          {
            name = "ilkecan bozdogan";
            email = "ilkecan@protonmail.com";
            github = "ilkecan";
            githubId = "40234257";
          }
        ];
        platforms = supportedSystems;
      };

      derivations = {
        eez-studio = import ./nix/eez-studio.nix commonArgs;
      };
    in
    {
      overlays = createOverlays derivations {
        inherit
          nix-utils
        ;
      };
      overlay = self.overlays.eez-studio;
    } // eachSystem supportedSystems (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = attrValues self.overlays ++ [
            (final: prev: { npmlock2nix = import npmlock2nix { pkgs = prev; }; })
          ];
        };

        packageNames = attrNames derivations;
      in
      rec {
        checks = packages;

        packages = getAttrs packageNames pkgs;
        defaultPackage = packages.eez-studio;

        hydraJobs = {
          build = packages;
        };

        devShell =
          let
            packageList = attrValues packages;
          in
          pkgs.mkShell {
            packages = packageList;

            shellHook = ''
              $(${defaultPackage.preConfigure}) || true
              export PATH=./node_modules/.bin:$PATH
            '';
          };
      });
}
