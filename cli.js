const program = require('commander')

console.log(process.argv)
if (process.argv.length > 1)
program
  .version('0.5.0')
  .option('-i, --interactive', 'Run in command-line interactive mode')
  .parse(process.argv)

module.exports = program