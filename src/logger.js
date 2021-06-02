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
      console.log(this.timestamp + message);
    },
    get timestamp() {
      return new Date().toLocaleString();
    },
  };
}

exports.createLogger = createLogger;
