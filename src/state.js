const saveState = (page) => {
  return page.evaluate(() => {
    const snapEscape = (() => {
      const UNSAFE_CHARS_REGEXP = /[<>\/\u2028\u2029]/g;
      // Mapping of unsafe HTML and invalid JavaScript line terminator chars to their
      // Unicode char counterparts which are safe to use in JavaScript strings.
      const ESCAPED_CHARS = {
        "<": "\\u003C",
        ">": "\\u003E",
        "/": "\\u002F",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029",
      };
      const escapeUnsafeChars = (unsafeChar) => ESCAPED_CHARS[unsafeChar];
      return (str) => str.replace(UNSAFE_CHARS_REGEXP, escapeUnsafeChars);
    })();

    const snapStringify = (obj) => snapEscape(JSON.stringify(obj));
    let state;
    if (
      window.snapSaveState &&
      (state = window.snapSaveState()) &&
      Object.keys(state).length !== 0
    ) {
      const scriptTagText = Object.keys(state)
        .map((key) => `window["${key}"]=${snapStringify(state[key])};`)
        .join("");
      if (scriptTagText !== "") {
        const scriptTag = document.createElement("script");
        scriptTag.type = "text/javascript";
        scriptTag.text = scriptTagText;
        const firstScript = Array.from(document.scripts)[0];
        firstScript.parentNode.insertBefore(scriptTag, firstScript);
      }
    }
  });
};

exports.saveState = saveState;
