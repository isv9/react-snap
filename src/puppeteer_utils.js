const puppeteer = require("puppeteer");
const _ = require("highland");
const url = require("url");
const path = require("path");
const fs = require("fs");

const errorToString = (jsHandle) =>
  jsHandle.executionContext().evaluate((e) => e.toString(), jsHandle);

const objectToJson = (jsHandle) => jsHandle.jsonValue();

/**
 * @param {{page: Page, route: string, onError: ?function }} opt
 * @return {void}
 */
const enableLogging = (opt) => {
  const { page, options, route, onError } = opt;
  page.on("console", (msg) => {
    const text = msg.text();
    if (text === "JSHandle@object") {
      Promise.all(msg.args().map(objectToJson)).then((args) =>
        console.log(`💬  console.log at ${route}:`, ...args)
      );
    } else if (text === "JSHandle@error") {
      Promise.all(msg.args().map(errorToString)).then((args) => {
        console.log(`💬  console.log at ${route}:`, ...args);
      });
    } else if (
      !text.includes(".woff2") &&
      text !== "Failed to load resource: net::ERR_FAILED"
    ) {
      console.log(`️️️💬  console.log at ${route}:`, text);
    }
  });
  page.on("error", (msg) => {
    console.log(`🔥  error at ${route}:`, msg);
    onError && onError();
  });
  page.on("pageerror", (e) => {
    console.log(`🔥  pageerror at ${route}:`, e);
    onError && onError();
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      let route = "";
      try {
        route = response._request
          .headers()
          .referer.replace(`http://localhost:${options.port}`, "");
      } catch (e) {}
      console.log(
        `️️️⚠️  warning at ${route}: got ${response.status()} HTTP code for ${response.url()}`
      );
    }
  });
  // page.on("requestfailed", msg =>
  //   console.log(`️️️⚠️  ${route} requestfailed:`, msg)
  // );
};

const allowRequestTypeList = [
  "document",
  "script",
  "xhr",
  "fetch",
  "stylesheet",
];
function onRequest(req) {
  if (
    allowRequestTypeList.includes(req.resourceType()) ||
    (req.resourceType() === "other" && req.url().endsWith("chunk.js"))
  ) {
    return req.continue();
  }
  return req.abort();
}

/**
 * can not use null as default for function because of TS error https://github.com/Microsoft/TypeScript/issues/14889
 *
 * @param {{options: *, basePath: string, afterFetch: ?(function({ page: Page, browser: Browser, route: string }):Promise)}} opt
 * @return {Promise}
 */
const crawl = async (opt) => {
  const { options, basePath, afterFetch, publicPath, sourceDir } = opt;
  let shuttingDown = false;
  let streamClosed = false;

  const onSigint = () => {
    if (shuttingDown) {
      process.exit(1);
    } else {
      shuttingDown = true;
      console.log(
        "\nGracefully shutting down. To exit immediately, press ^C again"
      );
    }
  };
  process.on("SIGINT", onSigint);

  const onUnhandledRejection = (error) => {
    console.log("🔥  UnhandledPromiseRejectionWarning", error);
    shuttingDown = true;
  };
  process.on("unhandledRejection", onUnhandledRejection);

  const skipRoutes = [];
  const crawledRoutes = [];
  const failPaths = [];
  const queue = _();
  let enqued = 0;
  let processed = 0;
  // use Set instead
  const uniqueUrls = new Set();

  /**
   * @param {string} path
   * @returns {void}
   */
  const addToQueue = (newUrl) => {
    const { hostname, search, hash, port } = url.parse(newUrl);
    newUrl = newUrl.replace(`${search || ""}${hash || ""}`, "");

    // Ensures that only link on the same port are crawled
    //
    // url.parse returns a string,
    // but options port is passed by a user and default value is a number
    // we are converting both to string to be sure
    // Port can be null, therefore we need the null check
    const isOnAppPort = port && port.toString() === options.port.toString();

    if (
      hostname === "localhost" &&
      isOnAppPort &&
      !uniqueUrls.has(newUrl) &&
      !streamClosed
    ) {
      uniqueUrls.add(newUrl);
      enqued++;
      queue.write(newUrl);
    }
  };

  const browser = await puppeteer.launch({
    headless: options.headless,
    args: options.puppeteerArgs,
    executablePath: options.puppeteerExecutablePath,
    ignoreHTTPSErrors: options.puppeteerIgnoreHTTPSErrors,
    handleSIGINT: false,
  });

  /**
   * @param {string} pageUrl
   * @returns {Promise<string>}
   */
  const fetchPage = async (pageUrl) => {
    if (options.debug) {
      console.time(`ReactSnap: fetchPage ${pageUrl}`);
    }
    try {
      const route = pageUrl.replace(basePath, "");

      let skipExistingFile = false;
      const routePath = route.replace(/\//g, path.sep);
      const { ext } = path.parse(routePath);
      if (ext !== ".html" && ext !== "") {
        const filePath = path.join(sourceDir, routePath);
        skipExistingFile = fs.existsSync(filePath);
      }

      if (!shuttingDown && !skipExistingFile) {
        try {
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on("request", onRequest);

          await page._client.send("ServiceWorker.disable");
          await page.setCacheEnabled(options.puppeteer.cache);
          if (options.viewport) await page.setViewport(options.viewport);
          let isError = false;
          enableLogging({
            page,
            options,
            route,
            onError: () => {
              isError = true;
              shuttingDown = true;
            },
          });
          await page.setUserAgent(options.userAgent);
          if (options.debug) {
            console.time(`ReactSnap: page goto ${pageUrl}`);
          }
          try {
            await page.goto(pageUrl, { waitUntil: "networkidle0" });
          } finally {
            if (options.debug) {
              console.timeEnd(`ReactSnap: page goto ${pageUrl}`);
            }
          }
          afterFetch &&
            (await afterFetch({ page, route, browser, addToQueue }));
          await page.close();
          if (!isError) {
            crawledRoutes.push(route);
            console.log(
              `✅  crawled ${processed + 1} out of ${enqued} (${route})`
            );
          } else {
            failPaths.push(route);
          }
        } catch (e) {
          failPaths.push(route);
          if (!shuttingDown) {
            console.log(`🔥  error at ${route}`, e);
          }
          shuttingDown = true;
        }
      } else {
        skipRoutes.push(route);
        // this message creates a lot of noise
        // console.log(`🚧  skipping (${processed + 1}/${enqued}) ${route}`);
        // TEMP Work around "Cannot write to stream after nil" issue by including an `await` in this `else` branch
        await Promise.resolve();
        // console.log(`🚧  skipping (${processed + 1}/${enqued}) ${route}`);
      }
      processed++;
      if (enqued === processed) {
        streamClosed = true;
        queue.end();
      }
      return pageUrl;
    } finally {
      if (options.debug) {
        console.timeEnd(`ReactSnap: fetchPage ${pageUrl}`);
      }
    }
  };

  if (options.include) {
    options.include.map((x) => addToQueue(`${basePath}${x}`));
  }

  return new Promise((resolve, reject) => {
    queue
      .map((x) => _(fetchPage(x)))
      .mergeWithLimit(options.concurrency)
      .toArray(async () => {
        process.removeListener("SIGINT", onSigint);
        process.removeListener("unhandledRejection", onUnhandledRejection);
        await browser.close();
        if (shuttingDown)
          return reject({ skipRoutes, crawledRoutes, failPaths });
        resolve();
      });
  });
};

exports.enableLogging = enableLogging;
exports.crawl = crawl;
