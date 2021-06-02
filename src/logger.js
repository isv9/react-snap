function createLogger(userOptions) {
  return {
    time(label) {
      if (userOptions?.debug) {
        console.time(label);
      }
    },
    timeEnd(label) {
      if (userOptions?.debug) {
        console.timeEnd(label);
      }
    },
    log(...messages) {
      console.log(`${this.timestamp}: `, ...messages);
    },
    get timestamp() {
      const date = new Date();
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const hours = date.getHours().toString().padStart(2, "0");
      const second = date.getSeconds().toString().padStart(2, "0");
      const millisecond = date.getMilliseconds().toString().padStart(2, "0");
      return `[${day}-${month}-${date.getFullYear()} ${hours}:${minutes}:${second}:${millisecond}]`;
    },
  };
}

exports.createLogger = createLogger;
