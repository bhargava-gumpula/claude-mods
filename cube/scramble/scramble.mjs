// Prints one random-state scramble (WCA method, via cubing.js) as the last stdout line.
import { randomScrambleForEvent } from 'cubing/scramble'

const scramble = await randomScrambleForEvent(process.argv[2])
console.log(JSON.stringify(scramble.toString()))
process.exit(0)
