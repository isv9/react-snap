const path = require("path");
const mkdirp = require("mkdirp");
const minify = require("html-minifier").minify;

const saver = {
  htmlString,
  html: async (props) => {
    let { page, filePath, route, fs } = props;
    const title = await page.title();
    const content = await htmlString(props);
    filePath = filePath.replace(/\//g, path.sep);
    if (route.endsWith(".html")) {
      if (route.endsWith("/404.html") && !title.includes("404"))
        console.log(
          '⚠️  warning: 404 page title does not contain "404" string'
        );
      mkdirp.sync(path.dirname(filePath));
      fs.writeFileSync(filePath, content);
    } else {
      if (title.includes("404"))
        console.log(`⚠️  warning: page not found ${route}`);
      mkdirp.sync(filePath);
      fs.writeFileSync(path.join(filePath, "index.html"), content);
    }
  },
};

async function htmlString({ page, options }) {
  let content = await page.content();
  return options.minifyHtml ? minify(content, options.minifyHtml) : content;
}

exports.saver = saver;
