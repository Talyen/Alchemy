// A failed operation rejects its caller without preventing later work.
function createSerialOperations() {
  let tail = Promise.resolve();
  return {
    enqueue(operation) {
      const result = tail.then(operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    drain: () => tail,
  };
}

module.exports = { createSerialOperations };
