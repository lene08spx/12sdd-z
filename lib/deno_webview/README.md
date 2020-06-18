# deno_webview

[![license](https://img.shields.io/github/license/eliassjogreen/deno_webview)](https://github.com/eliassjogreen/deno_webview/blob/master/LICENSE)
[![stars](https://img.shields.io/github/stars/eliassjogreen/deno_webview)](https://github.com/eliassjogreen/deno_webview/stargazers)
[![issues](https://img.shields.io/github/issues/eliassjogreen/deno_webview)](https://github.com/eliassjogreen/deno_webview/issues)
[![ci](https://github.com/eliassjogreen/deno_webview/workflows/ci/badge.svg)](https://github.com/eliassjogreen/deno_webview/actions)
[![releases](https://img.shields.io/github/downloads/eliassjogreen/deno_webview/total)](https://github.com/eliassjogreen/deno_webview/releases/latest/)
[![deno version](https://img.shields.io/badge/deno-1.0.5-success)](https://github.com/denoland/deno)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/webview/mod.ts)

This project provides [deno](https://github.com/denoland/deno) bindings for
[webview](https://github.com/zserge/webview) using the
[webview rust bindings](https://github.com/Boscop/web-view). Webview is a tiny
cross-platform library to render web-based GUIs for desktop applications. This
project is still in an early stage of development and stability is sometimes
questionable. The plugin should be compatible with MacOS (recently ran into some
problems, but cannot solve the problem myself as i do not have acces to a mac),
Linux and Windows. It has been tested on Windows and Xubuntu where it worked as
expected using the latest versions of deno. The current goal of deno_webview is
to provide high quality bindings to webview for creating light cross-platform
applications using web technologies.

![Example image](images/deno_webview.png)

## Example

Run the following code with the `-A` and `--unstable` (and `-r` if you have
used this module before) flags enabled to get the example shown above:

```ts
import { WebView } from "../mod.ts";

const html = (n: number) =>
  `
  <html>
  <body>
    <h1>${n}</h1>
  </body>
  </html>
`;

const webview1 = new WebView({
  title: "Multiple deno_webview example",
  url: `data:text/html,${encodeURIComponent(html(1))}`,
  width: 400,
  height: 200,
  resizable: true,
  debug: true,
  frameless: false,
});

const webview2 = new WebView({
  title: "Multiple deno_webview example",
  url: `data:text/html,${encodeURIComponent(html(2))}`,
  width: 400,
  height: 200,
  resizable: true,
  debug: true,
  frameless: false,
});

await Promise.all([webview1.run(), webview2.run()]);
```

or just run the following in the terminal:

```
deno run -A -r --unstable https://deno.land/x/webview/examples/multiple.ts
```

## Docs

Docs can be found
[here](https://doc.deno.land/https/deno.land/x/webview/mod.ts).

Mac specific: To use inline html you must first `encodeURIComponent` (#15).

## Development

### Prerequisites

For building deno_webview the same
[prerequisites](https://deno.land/std/manual.md#prerequisites) as for building
deno is required (mostly).

#### Linux

- [webkit2gtk](https://webkitgtk.org/) (to install using apt:
  `sudo apt-get install libwebkit2gtk-4.0-dev`)

### Cloning

To clone the repo simply run the following:

```
git clone https://github.com/eliassjogreen/deno_webview.git
```

and then cd into the repo:

```
cd deno_webview
```

### Building

Building deno_webview takes about 20-50 minutes the first time (then like a
minute) depending on your operating system. When building on Windows admin is
required. Building is easiest done by running:

```
deno run -A scripts/build.ts
```

or

```
cargo build --release --locked
```

optionally with mshtml

```
deno run -A scripts/build.ts mshtml
```

or

```
cargo build --release --locked --no-default-features
```

### Running

To run deno_webview without automatically downloading the binaries from
[releases](https://github.com/eliassjogreen/deno_webview/releases) you will need
to use the enviornment variable `DENO_WEBVIEW_PLUGIN` and set it to the path where the binaries
are located. This is usually `file://./target/release`. The process of running a
using local binaries can be easier to do using the
[dev script](https://github.com/eliassjogreen/deno_webview/tree/master/scripts/dev.ts):

```
deno -A scripts/dev.ts example.ts
```

## Environment variables

-   `DENO_WEBVIEW_PLUGIN` - The URL of the plugin  
    Due to MSHTML (ie) no longer being enabled by default, the only way to enable it is to set the `DENO_WEBVIEW_PLUGIN` variable to the path of a binary
    build built with the `--no-default-features` flag or using
    `deno -A scripts/build.ts mshtml`
-   `DENO_WEBVIEW_PLUGIN_BASE` - The URL of the plugin except the last part. Ignored if `DENO_WEBVIEW_PLUGIN` is set.  
    When developing locally `DENO_WEBVIEW_PLUGIN_BASE` should be set to the directory containing the plugin binary, usually `file://./target/release`. Otherwise, don't set this.
-   `DENO_WEBVIEW_DEBUG` - Disable cache and enable logs for `deno-plugin-prepare`. Used for debugging.

## Contributing

Contributions either in the form of pull requests or issues are always welcome.
Just remember to format using `deno -A scripts/fmt.ts` (`deno fmt` and
`cargo fmt`). Thx <3

## Dependencies

### Deno

- [plugin_prepare](https://deno.land/x/plugin_prepare)

### Rust

- [deno_core](https://crates.io/crates/deno_core)
- [webview-sys](https://crates.io/crates/webview-sys)
- [serde](https://crates.io/crates/serde)
- [serde_json](https://crates.io/crates/serde_json)
