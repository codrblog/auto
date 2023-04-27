import config from '@cloud-cli/jest-config'

export default {
  ...config,
  transformIgnorePatterns: ['/node_modules/(?!(@cloud-cli|bar)/)']
};