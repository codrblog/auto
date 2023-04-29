# auto

Unleash the power of AI and Automation!

## Env

| name      | description            | required |
| --------- | ---------------------- | -------- |
| APP_LOGS  | Path to output logfile | true     |
| API_KEY   | Chat API key           | true     |
| API_MODEL | Chat model to use      | true     |
| PORT      | http port              | true     |

## Stream events

|name | description |
|-|-|
| `cancel` | Current task was cancelled |
| `next` | AI responded with a new step  |
| `results` | Output of commands that were executed |
| `error` | Error from last executed commands |
| `halt` | AI has no more commands to execute |
| `history` | Session was completed |