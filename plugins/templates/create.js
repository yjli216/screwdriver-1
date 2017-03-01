'use strict';

const boom = require('boom');
const schema = require('screwdriver-data-schema');
const hoek = require('hoek');
const urlLib = require('url');
const jwt = require('jsonwebtoken');

module.exports = () => ({
    method: 'POST',
    path: '/templates',
    config: {
        description: 'Create a new template',
        notes: 'Create a specific template',
        tags: ['api', 'templates'],
        auth: {
            strategies: ['token', 'session'],
            scope: ['build']
        },
        plugins: {
            'hapi-swagger': {
                security: [{ token: [] }]
            }
        },
        handler: (request, reply) => {
            const pipelineFactory = request.server.app.pipelineFactory;
            const templateFactory = request.server.app.templateFactory;
            const token = request.auth.credentials.token;
            const decoded = jwt.decode(token);
            const pipelineId = decoded.pipelineId;

            // If nothing is there -> just create
            // If soemthing is there (existedTemplate -- same name)->
            //      check scmUri of this current build is the same as existedTemplate's scmUri
            //      check version. done in model
            //          if version already exists, need to check if test, if test then ok
            //          if version doesn't exist, then its ok.
            return Promise.all([
                pipelineFactory.get(pipelineId),
                templateFactory.get({ name: request.payload.name })
            ]).then(([pipeline, template]) => {
                if (template && pipeline.scmUri !== template.scmUri) {
                    throw boom.unauthorized('Not allowed to publish this platform');
                }
                const templateConfig = hoek.applyToDefaults(request.payload,
                    {
                        scmUri: pipeline.scmUri,
                        config: request.payload.config
                    });

                return templateFactory.create(templateConfig);
            })
            .then((template) => {
                const location = urlLib.format({
                    host: request.headers.host,
                    port: request.headers.port,
                    protocol: request.server.info.protocol,
                    pathname: `${request.path}/${template.id}`
                });

                return reply(template.toJson()).header('Location', location).code(201);
            })
            // something broke, respond with error
            .catch(err => reply(boom.wrap(err)));
        },
        validate: {
            payload: schema.models.template.create
        }
    }
});
