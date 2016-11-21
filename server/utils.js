import {Meteor} from "meteor/meteor";
import pg from "pg";
import log4js from "log4js";
/*StopWords spanish - english version*/
import {Spanish} from "../imports/startup/spanish.js";
import {English} from "../imports/startup/english.js";
/*Posts*/
import {Posts} from "../imports/api/posts.js";
import {Projects} from '../imports/api/projects';
/*Algorithms and libraries*/
//import 'log4js/lib/appenders/stdout'
//import 'log4js/lib/appenders/stderr'
import {BM25} from "../imports/startup/bm25.js";
import natural from "natural";
import lda from "lda";
import mokolo from "mokolo";
import util from "util";

log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file('./performance.log'), 'iknow');
let logger = log4js.getLogger('iknow');
let tfidf;
TfIdf = natural.TfIdf;
let extend = util._extend;

/*Constants*/
const TFIDF_TYPE = '1';
const BM25_TYPE = '2';
const BOTH_TYPE = '3';

Meteor.methods({
    'utils.projects'(){
        let promise = new Promise((resolve) => {
            resolve(Projects.find({_id: {$in: [134,135,136,137,138,185,187,189,191,193]}}));
        });
        return Promise.await(promise);
    },

    'utils.users'(words){
        let client = new pg.Client(POSTGRES_CONNECT);
        let promise = new Promise((resolve) => {
            client.connect(function (error) {
                if (error) throw error;
                //We join tables tasks, subtasks and commits and create one document corpus by User
                return client.query(
                    'select task_users.user_id,CONCAT(users.email,\' \',users.name) as userinfo,' +
                    'CONCAT(json_agg(DISTINCT CONCAT(tasks.name,\' \',' +
                    'tasks.description)),\' \',' +
                    'json_agg(commits.message) ,\' \',' +
                    'json_agg(sub_tasks.name)) as texto ' +
                    'from task_users ' +
                    'left join users on task_users.user_id = users.id ' +
                    'left join tasks on task_users.task_id = tasks.id ' +
                    'left join sub_tasks on tasks.id = sub_tasks.task_id ' +
                    'left join commits on tasks.id   = commits.task_id ' +
                    'where task_users.user_id is not null ' +
                    'group by task_users.user_id,users.email,users.name',
                    [],
                    function (error, result) {
                        if (error) throw error;
                        let tfidf = new TfIdf();
                        for (var i = 0; i <= result.rows.length - 1; i++) {
                            //We delete accents, special characters and numbers
                            let document = cleanInformation(result.rows[i].texto);
                            tfidf.addDocument(document, result.rows[i].user_id);
                        }
                        let response = [];
                        //TF-IDF according to relevant words received in this method
                        tfidf.tfidfs(words, function (i, measure) {
                            response.push({user: result.rows[i].userinfo, tfidf: measure});
                        });
                        //TOP-5 ranking
                        response = response.sort((a, b) => b.tfidf - a.tfidf).slice(0, 5);
                        resolve(response);
                    }
                );
            });
        });
        return Promise.await(promise);
    },

    'utils.recommendations'(id, method, uselda = false, mf = false){
        let start = clock();
        let client = new pg.Client(POSTGRES_CONNECT);
        let promise = new Promise((resolve) => {
            client.connect(function (error) {
                if (error) throw error;
                let query = '';
                let params = [];
                if (uselda) {
                    query = 'where tasks.project_id=$1 ';
                    params = [id];
                }
                //We join tables tasks, subtasks and commits and create one document corpus by Project
                return client.query(
                    'select tasks.project_id,' +
                    'CONCAT(json_agg(DISTINCT CONCAT(tasks.name,\' \',' +
                    'tasks.description)),\' \',' +
                    'json_agg(sub_tasks.name),\' \',' +
                    'json_agg(commits.message)) as texto ' +
                    'from tasks ' +
                    'left join sub_tasks on tasks.id = sub_tasks.task_id ' +
                    'left join commits on tasks.id   = commits.task_id ' +
                    query +
                    'group by tasks.project_id ' +
                    'order by tasks.project_id',
                    params,
                    function (error, result) {
                        if (error) throw error;
                        let words;
                        if (uselda) {
                            words = ldaWords(result.rows[0].texto);
                        } else {
                            words = tfidfWords(result, id);
                        }
                        resolve(words);
                    }
                );
            });
        });

        let promise2;
        switch (method) {
            case TFIDF_TYPE:
                promise2 = tfidfMethod(promise, mf);
                break;
            case BM25_TYPE:
                promise2 = bm25Method(promise, mf);
                break;
            case BOTH_TYPE:
                promise2 = tfidfandBm25Method(promise, mf);
                break;
        }
        ;
        Promise.await(promise);
        let result = Promise.await(promise2);
        let duration = clock(start);
        logger.info("Method: " + method + ", LDA: " + uselda + ", MF: " + mf + " and duration: " + duration + " ms");
        return result;
    }

});

function tfidfandBm25Method(promise, useMf) {
    var promise2 = new Promise((resolve2) => {

        matchQuery(promise, useMf, Meteor.bindEnvironment((words, useMf) => {
            let responseAux1 = tfidfAlgorithm(words, useMf);
            let responseAux2 = bm25Algorithm(words, useMf);
            resolve2({result1: responseAux1, result2: responseAux2, words: words});
        }));
    });
    return promise2;
}

function bm25Algorithm(words, useMf) {
    var bm = new BM25;
    let postsAux = Posts.find({}, {}).fetch();
    postsAux.forEach(function (post) {
        let document = cleanInformation(post.title + ' ' + post.text, false);
        bm.addDocument({id: post._id, body: document});
    });
    bm.updateIdf();
    var response = bm.search(words.join(' '));
    response = response.sort((a, b) => b._score - a._score).slice(0, 5);
    let responseAux = response.map(function (item) {
        let post = Posts.findOne({_id: item.id});
        return {score: item._score, title: post.title, url: post.url, id: item.id}
    });
    return responseAux;
}

function tfidfAlgorithm(words, useMf) {
    tfidf = new TfIdf();
    //limit: 20
    let postsAux = Posts.find({}, {}).fetch();

    postsAux.forEach(function (post) {
        let document = cleanInformation(post.title + ' ' + post.text);
        tfidf.addDocument(document, post._id, true);
    });

    let response = [];
    let mergedTerms = null;
    let termsMatrix = null;
    if (useMf) {
        mergedTerms = [];
        for (let i = 0; i < tfidf.documents.length; i++) {
            let keys = Object.keys(tfidf.documents[i]);
            mergedTerms = extend(keys, mergedTerms);
        }
        //console.log(mergedTerms);
        termsMatrix = getNMF(tfidf, mergedTerms);
    }


    similarity(tfidf, words, termsMatrix, mergedTerms, function (i, similarity, id) {
        response.push({_id: id, tfidf: similarity});
    });

    response = response.sort((a, b) => b.tfidf - a.tfidf).slice(0, 5);
    let responseAux = response.map(function (item) {
        let post = Posts.findOne({_id: item._id});
        return {score: item.tfidf, title: post.title, url: post.url, id: item._id}
    });
    return responseAux;
}

function bm25Method(promise, useMf) {
    var promise2 = new Promise((resolve2) => {
        matchQuery(promise, useMf, Meteor.bindEnvironment((words, useMf) => {
            let responseAux = bm25Algorithm(words, useMf);
            resolve2({result1: responseAux, result2: null, words: words});
        }));
    });
    return promise2;
}

function tfidfMethod(promise, useMf) {
    var promise2 = new Promise((resolve2) => {
        matchQuery(promise, useMf, Meteor.bindEnvironment((words, useMf) => {
            let responseAux = tfidfAlgorithm(words, useMf);
            resolve2({result1: responseAux, result2: null, words: words});
        }));
    });
    return promise2;
}
function tfidfWords(result, id) {
    tfidf = new TfIdf();
    let j;
    for (var i = 0; i <= result.rows.length - 1; i++) {
        //To identify index of active project.
        if (result.rows[i].project_id == id) {
            j = i;
        }
        let document = cleanInformation(result.rows[i].texto);
        tfidf.addDocument(document, result.rows[i].project_id);
    }
    let words = [];
    //Internally, this function tokenize document (j) and
    //show  terms with their respective TF-IDF values
    tfidf.listTerms(j).forEach(function (item) {
        words.push({term: item.term, tfidf: item.tfidf});
    });

    //Top-5 ranking
    words = words.sort((a, b) => b.tfidf - a.tfidf).slice(0, 10);
    let wordsTerm = words.map(function (word) {
        return word.term;
    });
    return wordsTerm;
}


function ldaWords(document) {
    document = cleanInformation(document, false);
    // Extract sentences.
    document = document.match(/[^\.!\?]+[\.!\?]+/g);

    // Run LDA to get terms for 2 topics (5 terms each).
    let result = lda(document, 10, 3, ['en']);
    let words = [];
    let terms = [];
    // For each topic.
    for (var i in result) {
        var row = result[i];
        var h = 0;
        // For each term.
        for (var j in row) {
            var term = row[j];
            h++;
            if (h == 1) {
                if (!terms[term.term]) {
                    terms[term.term] = true;
                    words.push({term: term.term, score: term.probability});
                } else {
                    h = 0;
                }
            }
        }
    }

    //Top-5 ranking
    words = words.sort((a, b) => b.score - a.score).slice(0, 10);
    let wordsTerm = words.map(function (word) {
        return word.term;
    });
    return wordsTerm;
}

function matchQuery(promise, useMf, action) {
    promise.then((result) => {
        return action(result, useMf);
    }).catch((error) => {
        console.error("Error: " + error);
    });
}

//Function to calculate similarity between a given
//query and every document in the collection
function similarity(tfidf, terms, matrix, termsAux, callback) {
    //Array with dot products between query and document
    let tfidfs = new Array(tfidf.documents.length);

    //Calculate Σ(idf^2) for each term in query
    let result = terms.reduce(function (value, term) {
        let idf = tfidf.idf(term);
        idf = idf === Infinity ? 0 : idf;
        return value + ( Math.pow(idf, 2));
    }, 0.0);

    //Calculate length query
    let lengthQuery = Math.sqrt(result);

    for (let i = 0; i < tfidf.documents.length; i++) {
        let lengthDocument;
        tfidfs[i] = 0;
        lengthDocument = 0;
        for (let term in tfidf.documents[i]) {
            //different for key value (document name)
            if (term != '__key') {

                let tfidfAux;
                if (matrix) {
                    let pos;
                    if (termsAux.indexOf(term) != -1) {
                        pos = termsAux.indexOf(term);
                        tfidfAux = matrix[i][pos]
                    } else {
                        tfidfAux = tfidf.tfidf(term, i);
                    }
                } else {
                    tfidfAux = tfidf.tfidf(term, i);
                }
                //We verify is term query exist in terms from all documents
                if (terms.find(x => x == term)) {
                    //Dot product between query and document. Because term
                    //frequency in query always will be 1(don't repeat relevant
                    //words), we multiply tfidf * tfidf. In other case tfidf
                    //query will be (Term-frequency-query/maximum frequency)*idf
                    tfidfs[i] = tfidfs[i] + (tfidfAux * tfidfAux);
                }
                lengthDocument = lengthDocument + Math.pow(tfidfAux, 2);
            }
        }
        lengthDocument = Math.sqrt(lengthDocument);
        var similarity = 0;
        if (lengthDocument > 0 && lengthQuery > 0) {
            similarity = (tfidfs[i]) / (lengthDocument * lengthQuery);
        }
        if (callback)
            callback(i, similarity, tfidf.documents[i].__key);
    }
}

function getNMF(tfidf, terms) {

    var result = [];
    for (var i = 0; i < tfidf.documents.length; i++) {
        var documentAux = [];
        for (var term in terms) {
            var tfidfAux = 0.0001;
            if (tfidf.documents[i][terms[term]]) {
                tfidfAux = tfidf.tfidf([terms[term]], i);
            }
            documentAux.push(tfidfAux);
        }
        result.push(documentAux);
    }

    let nmf = new mokolo.NMF();

    let $M = require('sylvester').Matrix.create;
    let D = $M(result);
    let whAux;

    nmf.factorize({
            matrix: D
            , features: 2
            , iterations: 10
            , precision: 1e-10
        },
        function (W, H, WH, diff, iter, precision) {
            whAux = WH;
        }
    );

    return whAux.toArray();
};

function clock(start) {
    if (!start) return process.hrtime();
    var end = process.hrtime(start);
    return Math.round((end[0] * 1000) + (end[1] / 1000000));
}

function translate(document) {
    return document
        .replace(new RegExp('\\b(movil)\\b', 'g'), 'mobile')
        .replace(new RegExp('\\b(vista)\\b', 'g'), 'view')
        .replace(new RegExp('\\b(cliente|clientes)\\b', 'g'), 'customer')
        .replace(new RegExp('\\b(carro)\\b', 'g'), 'cart')
        .replace(new RegExp('\\b(paciente|pacientes)\\b', 'g'), 'patient')
        .replace(new RegExp('\\b(horario|horarios)\\b', 'g'), 'schedule')
        .replace(new RegExp('\\b(cita|citas)\\b', 'g'), 'appointment')
        .replace(new RegExp('\\b(arreglar)\\b', 'g'), 'fix')
        .replace(new RegExp('\\b(bloquear)\\b', 'g'), 'block')
        .replace(new RegExp('\\b(ficha|fichas)\\b', 'g'), 'tab')
        .replace(new RegExp('\\b(crear)\\b', 'g'), 'create')
        .replace(new RegExp('\\b(investigar|investigando)\\b', 'g'), 'investigate')
        .replace(new RegExp('\\b(investigacion)\\b', 'g'), 'research')
        .replace(new RegExp('\\b(reuniones)\\b', 'g'), 'reunion')
        .replace(new RegExp('\\b(realizar)\\b', 'g'), 'make')
        .replace(new RegExp('\\b(tecnologia)\\b', 'g'), 'technology')
        .replace(new RegExp('\\b(deployar)\\b', 'g'), 'deploy')
        .replace(new RegExp('\\b(producto|productos)\\b', 'g'), 'product')
        .replace(new RegExp('\\b(estudiar)\\b', 'g'), 'study')
        .replace(new RegExp('\\b(proyecto|proyectos)\\b', 'g'), 'project')
        .replace(new RegExp('\\b(grupal)\\b', 'g'), 'group')
        .replace(new RegExp('\\b(alumno|alumnos)\\b', 'g'), 'student')
        .replace(new RegExp('\\b(aprender)\\b', 'g'), 'learn')
        .replace(new RegExp('\\b(equipo|equipos)\\b', 'g'), 'team')
        .replace(new RegExp('\\b(servidor)\\b', 'g'), 'server')
        .replace(new RegExp('\\b(negociacion)\\b', 'g'), 'negotiation')
        .replace(new RegExp('\\b(organizar)\\b', 'g'), 'organize')
        .replace(new RegExp('\\b(basico|basicos)\\b', 'g'), 'basic');
}

function cleanInformation(document, tokenized = true) {
    //natural.PorterStemmer.attach();
    //natural.LancasterStemmer.attach();
    tokenizer = new natural.WordTokenizer();

    document = document.toLowerCase()
        .replace(new RegExp('\\w(_)\\w', 'g'), ' ')
        .replace(/\d+/g, ' ')
        .replace(new RegExp('\\b(á)\\b', 'g'), 'a')
        .replace(new RegExp('\\b(é)\\b', 'g'), 'e')
        .replace(new RegExp('\\b(í)\\b', 'g'), 'i')
        .replace(new RegExp('\\b(ó)\\b', 'g'), 'o')
        .replace(new RegExp('\\b(ú)\\b', 'g'), 'u')
        .replace(new RegExp('\\b(' + Spanish.join('|') + ')\\b', 'g'), ' ')
        .replace(new RegExp('\\b(' + English.join('|') + ')\\b', 'g'), ' ');
    //.tokenizeAndStem();
    document = translate(document);

    if (tokenized)
        document = tokenizer.tokenize(document);

    return document;
}
