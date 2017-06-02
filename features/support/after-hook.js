'use strict';

const sdapi = require('./sdapi');

/**
 * After hooks
 * @return
 */
function afterHooks() {
    this.After('@apitoken', () => {
        if (this.testToken) {
            return sdapi.cleanupToken({
                token: this.testToken.name,
                instance: this.instance,
                namespace: this.namespace,
                jwt: this.jwt
            });
        }

        return null;
    });
}

module.exports = afterHooks;
