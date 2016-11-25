"use strict";
const pg = require('pg');
const jsonfile = require('jsonfile');

const config = {
    user: 'postgres',
    password: 'blabla',
    database: 'smartboard',
    host: '192.168.133.130',
    port: 5432
};

let client = new pg.Client(config);

client.connect(function (error) {
    if (error) {
        return console.error('error fetching client from pool: ', error);
    }

    readTable('users', () => {
        readTable('projects', () => {
            readTable('tasks', () => {
                readTable('commits', () => {
                    readTable('sub_tasks', () => {
                        client.end();
                    });
                });
            });
        });
    });
});

function readTable(table, done) {
    client.query('SELECT * FROM ' + table, [], function (error, result) {
        if (error) {
            return console.error('error running query', error);
        }
        let file = './private/' + table + ".json";
        jsonfile.writeFile(file, result.rows, {spaces: 4}, function (error) {
            if (error)
                console.error('error writing users.json', error);
            console.log("Finished reading ", table);
            done();
        });
    })
}