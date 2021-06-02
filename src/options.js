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
  waitForInitialPage: true,
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
  fixWebpackChunksIssue: true,
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
const normalizeUserOptions = (userOptions) => {
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

  if (options.saveAs !== "html" && options.saveAs !== "htmlString") {
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

exports.defaultOptions = defaultOptions;
exports.normalizeUserOptions = normalizeUserOptions;
