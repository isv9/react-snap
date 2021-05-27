const crawl = require("./src/puppeteer_utils.js").crawl;
const path = require("path");
const nativeFs = require("fs");
const mkdirp = require("mkdirp");
const minify = require("html-minifier").minify;

const defaultOptions = {
  //# stable configurations
  port: 45678,
  source: "build",
  destination: null,
  concurrency: 4,
  include: ["/"],
  userAgent: "ReactSnap",
  debug: false,
  // 4 params below will be refactored to one: `puppeteer: {}`
  // https://github.com/stereobooster/react-snap/issues/120
  headless: true,
  puppeteer: {
    cache: true,
  },
  puppeteerArgs: [],
  puppeteerExecutablePath: undefined,
  puppeteerIgnoreHTTPSErrors: false,
  publicPath: "/",
  minifyHtml: {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: true,
    keepClosingSlash: true,
    sortAttributes: true,
    sortClassName: false,
  },
  // mobile first approach
  viewport: {
    width: 480,
    height: 850,
  },
  //# workarounds
  // using CRA1 for compatibility with previous version will be changed to false in v2
  fixWebpackChunksIssue: "CRA1",
  skipThirdPartyRequests: false,
  //# feature creeps to generate screenshots
  saveAs: "html",
  crawl: true,
  waitFor: false,
};

/**
 *
 * @param {{source: ?string, destination: ?string, include: ?Array<string>, sourceMaps: ?boolean, skipThirdPartyRequests: ?boolean }} userOptions
 * @return {*}
 */
const defaults = (userOptions) => {
  const options = {
    ...defaultOptions,
    ...userOptions,
  };
  options.destination = options.destination || options.source;

  let exit = false;
  if (!options.include || !options.include.length) {
    console.log("🔥  include option should be an non-empty array");
    exit = true;
  }

  if (options.fixWebpackChunksIssue === true) {
    console.log(
      "🔥  fixWebpackChunksIssue - behaviour changed, valid options are CRA1, CRA2, Parcel, false"
    );
    options.fixWebpackChunksIssue = "CRA1";
  }
  if (
    options.saveAs !== "html" &&
    options.saveAs !== "png" &&
    options.saveAs !== "none" &&
    options.saveAs !== "jpeg"
  ) {
    console.log("🔥  saveAs supported values are html, png, and jpeg");
    exit = true;
  }
  if (exit) throw new Error();

  if (!options.publicPath.startsWith("/")) {
    options.publicPath = `/${options.publicPath}`;
  }
  options.publicPath = options.publicPath.replace(/\/$/, "");

  options.include = options.include.map(
    (include) => options.publicPath + include
  );
  return options;
};

const normalizePath = (path) => (path === "/" ? "/" : path.replace(/\/$/, ""));

const fixWebpackChunksIssue2 = ({
  page,
  basePath,
}) => {
  return page.evaluate(
    (basePath) => {
      const localScripts = Array.from(document.scripts).filter(
        (x) => x.src && x.src.startsWith(basePath)
      );
      // CRA v2
      const mainRegexp = /main\.[\w]{8}\.chunk\.js/;
      const mainScript = localScripts.find((x) => mainRegexp.test(x.src));

      if (!mainScript) return;

      const chunkRegexp = /(\w+)\.[\w]{8}\.chunk\.js/g;

      const headScripts = Array.from(document.querySelectorAll("head script"))
        .filter((x) => x.src && x.src.startsWith(basePath))
        .filter((x) => {
          const matched = chunkRegexp.exec(x.src);
          // we need to reset state of RegExp https://stackoverflow.com/a/11477448
          chunkRegexp.lastIndex = 0;
          return matched;
        });

      const chunkScripts = localScripts.filter((x) => {
        const matched = chunkRegexp.exec(x.src);
        // we need to reset state of RegExp https://stackoverflow.com/a/11477448
        chunkRegexp.lastIndex = 0;
        return matched;
      });

      const createLink = (x) => {
        const linkTag = document.createElement("link");
        linkTag.setAttribute("rel", "preload");
        linkTag.setAttribute("as", "script");
        linkTag.setAttribute("href", x.src.replace(basePath, ""));
        document.head.appendChild(linkTag);
      };

      for (let i = headScripts.length; i <= chunkScripts.length - 1; i++) {
        const x = chunkScripts[i];
        if (x.parentElement && mainScript.parentNode) {
          createLink(x);
        }
      }

      for (let i = headScripts.length - 1; i >= 0; --i) {
        const x = headScripts[i];
        if (x.parentElement && mainScript.parentNode) {
          x.parentElement.removeChild(x);
          createLink(x);
        }
      }
    },
    basePath,
  );
};

const saveAsHtml = async ({ page, filePath, options, route, fs }) => {
  let content = await page.content();
  content = content.replace(/react-snap-onload/g, "onload");
  const title = await page.title();
  const minifiedContent = options.minifyHtml
    ? minify(content, options.minifyHtml)
    : content;
  filePath = filePath.replace(/\//g, path.sep);
  if (route.endsWith(".html")) {
    if (route.endsWith("/404.html") && !title.includes("404"))
      console.log('⚠️  warning: 404 page title does not contain "404" string');
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, minifiedContent);
  } else {
    if (title.includes("404"))
      console.log(`⚠️  warning: page not found ${route}`);
    mkdirp.sync(filePath);
    fs.writeFileSync(path.join(filePath, "index.html"), minifiedContent);
  }
};

const run = async (userOptions, { fs } = { fs: nativeFs }) => {
  let options;
  if(userOptions?.debug){
    console.time('ReactSnap: defaults options time')
  }
  try {
    options = defaults(userOptions);
  } catch (e) {
    return Promise.reject(e.message);
  } finally {
    if(userOptions?.debug){
      console.timeEnd('ReactSnap: defaults options time')
    }
  }

  const sourceDir = path.normalize(`${process.cwd()}/${options.source}`);
  const destinationDir = path.normalize(
    `${process.cwd()}/${options.destination}`
  );

  if(options.debug){
    console.time('ReactSnap: checking exist file')
  }
  if (
    destinationDir === sourceDir &&
    options.saveAs === "html" &&
    fs.existsSync(path.join(sourceDir, "200.html"))
  ) {
    console.log(
      `🔥  200.html is present in the sourceDir (${sourceDir}). You can not run react-snap twice - this will break the build`
    );
    if(options.debug){
      console.timeEnd('ReactSnap: checking exist file')
    }
    return Promise.reject("");
  }

  fs.createReadStream(path.join(sourceDir, "index.html")).pipe(
    fs.createWriteStream(path.join(sourceDir, "200.html"))
  );

  if (destinationDir !== sourceDir && options.saveAs === "html") {
    mkdirp.sync(destinationDir);
      fs.createReadStream(path.join(sourceDir, "index.html")).pipe(
          fs.createWriteStream(path.join(destinationDir, "200.html"))
      );
  }

  if(options.debug){
    console.timeEnd('ReactSnap: checking exist file')
  }

  const basePath = `http://localhost:${options.port}`;
  const publicPath = options.publicPath;

  const crawlRandomId = Math.random()
  if(options.debug){
    console.time(`ReactSnap: crawl ${crawlRandomId}`)
  }
  try{
    await crawl({
      options,
      basePath,
      publicPath,
      sourceDir,
      afterFetch: async ({ page, route, browser, addToQueue }) => {
        if(options.debug){
          console.time(`ReactSnap: afterFetch ${route}`)
        }
        try{

          if(options.debug){
            console.time(`ReactSnap: fix chunks ${route}`)
          }
          try {
             if (options.fixWebpackChunksIssue === "CRA2") {
              await fixWebpackChunksIssue2({
                page,
                basePath,
              });
            }
          }finally {
            if(options.debug){
              console.timeEnd(`ReactSnap: fix chunks ${route}`)
            }
          }

          let routePath = route.replace(publicPath, "");
          let filePath = path.join(destinationDir, routePath);
          if(options.debug){
            console.time(`ReactSnap: saving as ${route}`)
          }
          try{
            if (options.saveAs === "html") {
              await saveAsHtml({ page, filePath, options, route, fs });
              let newRoute = await page.evaluate(() => location.toString());
              newPath = normalizePath(
                  newRoute.replace(publicPath, "").replace(basePath, "")
              );
              routePath = normalizePath(routePath);
              if (routePath !== newPath) {
                console.log(newPath);
                console.log(`💬  in browser redirect (${newPath})`);
                addToQueue(newRoute);
              }
            }
          }finally {
            if(options.debug){
              console.timeEnd(`ReactSnap: saving as ${route}`)
            }
          }
        } finally {
          if(options.debug){
            console.timeEnd(`ReactSnap: afterFetch ${route}`)
          }
        }
      },
    });
  } finally {
    if(options.debug){
      console.timeEnd(`ReactSnap: crawl ${crawlRandomId}`)
    }
  }
};

exports.defaultOptions = defaultOptions;
exports.run = run;
