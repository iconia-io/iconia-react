export const ac = new AbortController();

process.on("SIGINT", () => {
  ac.abort();
  process.stderr.write("\n");
  process.exit(130);
});
