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
            const name = request.payload.name;
            const labels = request.payload.labels || [];

            return Promise.all([
                pipelineFactory.get(pipelineId),
                templateFactory.get({ name })
            ]).then(([pipeline, template]) => {
                const templateConfig = hoek.applyToDefaults(request.payload, {
                    scmUri: pipeline.scmUri,
                    labels
                });

                // If template doesn't exist yet, just create a new entry
                if (!template) {
                    return templateFactory.create(templateConfig);
                }

                // If template exists, but this build's scmUri is not the same as template's scmUri
                // Then this build does not have permission to publish
                if (pipeline.scmUri !== template.scmUri) {
                    throw boom.unauthorized('Not allowed to publish this template');
                }

                // If template exists and has good permission, check the exact version
                return templateFactory.get({
                    name,
                    version: request.payload.version
                }).then((exactVersion) => {
                    // If the version doesn't exist, create a new entry
                    if (!exactVersion) {
                        return templateFactory.create(templateConfig);
                    }

                    // If the version exists, just update the labels
                    template.labels = [...new Set([...template.labels, ...labels])];

                    return template.update();
                });
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
