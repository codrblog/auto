import { createHmac } from 'crypto';
import { getAuthorizedSources, isRequestSignatureValid } from './github';

describe('github', () => {
  describe('validate request signature', () => {
    it('should validate a signature against a request body', () => {
      process.env.GITHUB_SECRET = 'secret';
      const requestSignature = 'sha1=' + createHmac('sha1', 'secret').update('test').digest('hex');

      expect(isRequestSignatureValid(requestSignature, 'teSt')).toBe(false);
      expect(isRequestSignatureValid(requestSignature, 'test')).toBe(true);
    });
  });

  describe('authorized sources', () => {
    it('should read orgs/users from environment', () => {
      process.env.APP_ORGS = 'one,two';
      process.env.APP_USERS = 'foo,bar';

      expect(getAuthorizedSources()).toEqual({
        authorizedUsers: ['foo', 'bar'],
        authorizedOrgs: ['one', 'two'],
      });
    });
  });
});
