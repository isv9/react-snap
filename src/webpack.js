const fixWebpackChunksIssue = ({ page, basePath }) => {
  return page.evaluate((basePath) => {
    const localScripts = Array.from(document.scripts).filter(
      (x) => x.src && x.src.startsWith(basePath)
    );
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
  }, basePath);
};

exports.fixWebpackChunksIssue = fixWebpackChunksIssue;
