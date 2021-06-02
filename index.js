const crawl = require("./src/puppeteer/puppeteer_utils.js").crawl;
const optionsModule = require("./src/options.js");
const webpackModule = require("./src/webpack.js");
const loggerModule = require("./src/logger.js");
const saver = require("./src/saver.js").saver;
const path = require("path");
const nativeFs = require("fs");
const mkdirp = require("mkdirp");

const run = async (userOptions, { fs } = { fs: nativeFs }) => {
  let options;
  const logger = loggerModule.createLogger(userOptions);
  logger.time("ReactSnap: defaults options time");
  try {
    options = optionsModule.normalizeUserOptions(userOptions);
  } catch (e) {
    return Promise.reject(e.message);
  } finally {
    logger.timeEnd("ReactSnap: defaults options time");
  }

  const sourceDir = path.normalize(`${process.cwd()}/${options.source}`);
  const destinationDir = path.normalize(
    `${process.cwd()}/${options.destination}`
  );

  logger.time("ReactSnap: checking exist file");

  if (
    destinationDir === sourceDir &&
    options.saveAs === "html" &&
    fs.existsSync(path.join(sourceDir, "200.html"))
  ) {
    logger.log(
      `🔥  200.html is present in the sourceDir (${sourceDir}). You can not run react-snap twice - this will break the build`
    );

    logger.timeEnd("ReactSnap: checking exist file");

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

  logger.timeEnd("ReactSnap: checking exist file");

  const basePath = `http://localhost:${options.port}`;
  const publicPath = options.publicPath;

  const crawlRandomId = Math.random();

  logger.time(`ReactSnap: crawl ${crawlRandomId}`);

  try {
    await crawl({
      options,
      basePath,
      publicPath,
      sourceDir,
      afterFetch: async ({ page, route }) => {
        logger.time(`ReactSnap: afterFetch ${route}`);

        try {
          logger.time(`ReactSnap: fix chunks ${route}`);

          try {
            if (options.fixWebpackChunksIssue) {
              await webpackModule.fixWebpackChunksIssue({
                page,
                basePath,
              });
            }
          } finally {
            logger.timeEnd(`ReactSnap: fix chunks ${route}`);
          }

          let routePath = route.replace(publicPath, "");
          let filePath = path.join(destinationDir, routePath);

          logger.time(`ReactSnap: saving as ${route}`);

          try {
            await saver[options.saveAs]?.({
              page,
              filePath,
              options,
              route,
              fs,
            });
          } finally {
            logger.timeEnd(`ReactSnap: saving as ${route}`);
          }
        } finally {
          logger.timeEnd(`ReactSnap: afterFetch ${route}`);
        }
      },
    });
  } finally {
    logger.timeEnd(`ReactSnap: crawl ${crawlRandomId}`);
  }
};

exports.defaultOptions = optionsModule.defaultOptions;
exports.run = run;
