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
    log(message) {
      console.log(`${this.timestamp}: ${message}`);
    },
    get timestamp() {
      const date = new Date();
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const hours = date.getHours().toString().padStart(2, "0");
      return `[${day}-${month}-${date.getFullYear()} ${hours}:${minutes}]`;
    },
  };
}

exports.createLogger = createLogger;
