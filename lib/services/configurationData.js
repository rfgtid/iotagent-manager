/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-manager
 *
 * iotagent-manager is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-manager is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-manager.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::daniel.moranjimenez@telefonica.com
 */

'use strict';

var Configuration = require('../model/Configuration'),
    iotagentLib = require('iotagent-node-lib'),
    errors = require('../errors'),
    logger = require('logops'),
    async = require('async'),
    context = {
        op: 'IoTAManager.ConfigurationDB'
    },
    provisioningAPITranslation = {
        /* jshint camelcase:false */

        name: 'id',
        service: 'service',
        service_path: 'subservice',
        entity_type: 'type',
        internal_attributes: 'internalAttributes'
    };


function createGetWithFields(fields) {
    return function() {
        var query,
            queryObj = {},
            i = 0,
            callback,
            limit,
            offset;

        while (typeof arguments[i] !== 'function') {
            if (arguments[i]) {
                if (fields[i] === 'limit') {
                    limit = parseInt(arguments[i], 10);
                } else if (fields[i] === 'offset') {
                    offset = parseInt(arguments[i], 10);
                } else {
                    queryObj[fields[i]] = arguments[i];
                }
            }

            i++;
        }

        callback = arguments[i];

        logger.debug('Looking for configuration with params %j', fields);

        query = Configuration.model.find(queryObj);

        if (limit) {
            query.limit(parseInt(limit, 10));
        }

        if (offset) {
            query.skip(parseInt(offset, 10));
        }

        async.series([
            query.exec.bind(query),
            Configuration.model.count.bind(Configuration.model, queryObj)
        ], function(error, results) {
            if (!error && results && results.length === 2) {
                callback(null, {
                    services: results[0],
                    count: results[1]
                });
            } else if (error) {
                callback(new errors.InternalDbError(error));
            } else {
                callback(new errors.DeviceGroupNotFound(fields, arguments));
            }
        });
    };
}

function save(protocol, description, iotagent, resource, configuration, oldConfiguration, callback) {
    var configurationObj = oldConfiguration || new Configuration.model(),
        attributeList = [
            'name',
            'apikey',
            'token',
            'service',
            'service_path',
            'entity_name',
            'entity_type',
            'timezone',
            'transport',
            'endpoint',
            'attributes',
            'commands',
            'lazy',
            'internal_attributes'
        ];

    logger.debug(context, 'Saving Configuration [%s][%s][%s]', protocol, iotagent, resource);

    configurationObj.protocol = protocol;
    configurationObj.description = description;
    configurationObj.iotagent = iotagent;
    configurationObj.resource = resource;

    for (var i = 0; i < attributeList.length; i++) {
        configurationObj[provisioningAPITranslation[attributeList[i]] || attributeList[i]] =
            configuration[attributeList[i]];
    }

    configurationObj.save(callback);
}

exports.get = iotagentLib.alarms.intercept(
    iotagentLib.constants.MONGO_ALARM,
    createGetWithFields(['apikey', 'resource', 'protocol']));

exports.save = iotagentLib.alarms.intercept(
    iotagentLib.constants.MONGO_ALARM,
    save);

exports.list = iotagentLib.alarms.intercept(
    iotagentLib.constants.MONGO_ALARM,
    createGetWithFields(['service', 'subservice', 'protocol', 'limit', 'offset']));
