import {Meteor} from "meteor/meteor";
import log4js from "log4js";
/*StopWords spanish - english version*/
import {Spanish} from "../imports/startup/spanish.js";
import {English} from "../imports/startup/english.js";
/*Posts*/
import {Posts} from "../imports/api/posts.js";
import {Loader} from "../imports/api/loader.js";
import {Projects} from "../imports/api/projects";
import {Tasks} from "../imports/api/tasks";
import {SubTasks} from "../imports/api/subTasks";
import {Commits} from "../imports/api/commits";
/*Algorithms and libraries*/
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
            resolve(Projects.find({_id: {$in: [134, 135, 136, 137, 138, 185, 187, 189, 191, 193]}}).fetch());
        });
        return Promise.await(promise);
    },

    'utils.recommendations'(id, method, uselda = false, mf = false){
        let start = clock();
        setLoader(15,'Extrayendo información de SmartBoard y ' +
        'construyendo perfil del proyecto.');
        let promise = new Promise((resolve) => {
            let query = '';
            if (uselda) {
                query = {_id: id};
            } else {
                query = {_id: {$in: [134, 135, 136, 137, 138, 185, 187, 189, 191, 193]}};
            }
            let response = [];
            let i = 1;
            let limit = Projects.find(query).count();
            Projects.find(query).fetch().forEach((project) => {
                let row = {
                    id: project._id,
                    text: ""
                };
                Tasks.find({project_id: parseInt(project._id, 10)}).fetch().forEach((task) => {
                    row.text = [row.text, task.name, task.description].join(" ");
                    SubTasks.find({task_id: parseInt(task._id, 10)}).fetch().forEach((subTask) => {
                        row.text = [row.text, subTask.name, subTask.description].join(" ");
                    });
                    Commits.find({task_id: parseInt(task._id)}).fetch().forEach((commit) => {
                        row.text = [row.text, commit.message].join(" ");
                    });
                });
                if(i % 10 === 0)
                {
                  let percentage = (i * 100 / limit).toFixed(2);
                  setLoader(50,'Extrayendo información de SmartBoard y ' +
                  'construyendo perfil del proyecto: ' + percentage + '%.');
                }
                i++;
                response.push(row);
            });
            if (uselda) {
                words = ldaWords(response[0].text);
            } else {
                words = tfidfWords(response, id);
            }
            resolve(words);
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
        Promise.await(promise);
        let result = Promise.await(promise2);
        let duration = clock(start);
        logger.info("Method: " + method + ", LDA: " + uselda + ", MF: " + mf + " and duration: " + duration + " ms");
        return result;
    }

});

function setLoader(percentage,description)
{
  let email = Meteor.user().emails[0].address;
  Loader.update({email: email}, {
      $set: {
          percentage: percentage, description: description
      }
  });
}

function tfidfandBm25Method(promise, useMf) {
    var promise2 = new Promise((resolve2) => {

        matchQuery(promise, useMf, Meteor.bindEnvironment((words, useMf) => {

            let bm = new BM25;
            tfidf = new TfIdf();
            setLoader(50,'Iniciando proceso de recomendación.');
            let i = 1;
            let limit = 3000;
            let postAux = Posts.find({}, {limit: limit, sort: {created_at: -1}}).fetch();
            postAux.forEach((post) => {
                let tokens = cleanInformation(post.title + ' ' + post.text);
                bm.addDocument({id: post._id, tokens: tokens});
                tfidf.addDocument(tokens, post._id, true);
                if(i % 10 === 0)
                {
                  let percentage = (i * 100 / limit).toFixed(2);
                  setLoader(50,'Procesando StackExchange posts ' + percentage + '%.');
                }
                i++;
            });
            let responseAux1 = tfidfAlgorithm(words, tfidf, useMf);
            let responseAux2 = bm25Algorithm(words, bm, useMf);
            resolve2({result1: responseAux1, result2: responseAux2, words: words});
        }));
    });
    return promise2;
}

function bm25Algorithm(words, bm, useMf) {
    setLoader(80,'Procesando recomendaciones BM25.');
    bm.updateIdf();
    var response = bm.search(words.join(' '));
    response = response.sort((a, b) => b._score - a._score).slice(0, 5);
    let responseAux = response.map(function (item) {
        let post = Posts.findOne({_id: item.id});
        return {score: item._score, title: post.title, url: post.url, id: item.id}
    });
    return responseAux;
}

function tfidfAlgorithm(words, tfidf, useMf) {
    let response = [];
    let mergedTerms = null;
    let termsMatrix = null;
    if (useMf) {
        setLoader(60,'Ejecutando matrix factorization sobre matrix TF-IDF.');
        mergedTerms = [];
        for (let i = 0; i < tfidf.documents.length; i++) {
            let keys = Object.keys(tfidf.documents[i]);
            mergedTerms = extend(keys, mergedTerms);
        }
        termsMatrix = getNMF(tfidf, mergedTerms);
    }
    let j = 1;
    setLoader(50,'Procesando similaridad en documentos contra perfil proyecto.');
    similarity(tfidf, words, termsMatrix, mergedTerms, function (i, similarity, id) {
      if(j % 10 === 0)
      {
        let percentage = (j * 100 / 3000).toFixed(2);
        setLoader(50,'Calculando similaridad ' + percentage + '%.');
      }
      j++;
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
            let bm = new BM25;
            let postsAux = Posts.find({}, {limit: 1000}).fetch();
            postsAux.forEach(function (post) {
                let tokens = cleanInformation(post.title + ' ' + post.text);
                bm.addDocument({id: post._id, tokens: tokens});
            });
            let responseAux = bm25Algorithm(words, bm, useMf);
            resolve2({result1: responseAux, result2: null, words: words});
        }));
    });
    return promise2;
}

function tfidfMethod(promise, useMf) {
    var promise2 = new Promise((resolve2) => {
        matchQuery(promise, useMf, Meteor.bindEnvironment((words, useMf) => {
            tfidf = new TfIdf();
            let postsAux = Posts.find({}, {limit: 1000}).fetch();
            postsAux.forEach(function (post) {
                let tokens = cleanInformation(post.title + ' ' + post.text);
                tfidf.addDocument(document, post._id, true);
            });
            let responseAux = tfidfAlgorithm(words, tfidf, useMf);
            resolve2({result1: responseAux, result2: null, words: words});
        }));
    });
    return promise2;
}
function tfidfWords(result, id) {
    tfidf = new TfIdf();
    let j;
    for (var i = 0; i <= result.length - 1; i++) {
        //To identify index of active project.
        if (result[i].id == parseInt(id, 10)) {
            j = i;
        }
        let document = cleanInformation(result[i].text);
        tfidf.addDocument(document, result[i].id);
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
    document = cleanInformation(document, true);
    // Extract sentences.
    //document = document.match(/[^\.!\?]+[\.!\?]+/g);
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
        .replace(new RegExp('\\b(requisito|requisitos)\\b', 'g'), 'requirement')
        .replace(new RegExp('\\b(contenido)\\b', 'g'), 'content')
        .replace(new RegExp('\\b(aplicacion|aplicaciones)\\b', 'g'), 'aplication')
        .replace(new RegExp('\\b(implementar)\\b', 'g'), 'implement')
        .replace(new RegExp('\\b(imagineria)\\b', 'g'), 'imagery')
        .replace(new RegExp('\\b(configuracion)\\b', 'g'), 'configuration')
        .replace(new RegExp('\\b(modelo)\\b', 'g'), 'model')
        .replace(new RegExp('\\b(preparar)\\b', 'g'), 'prepare')
        .replace(new RegExp('\\b(usuario|usuarios)\\b', 'g'), 'user')
        .replace(new RegExp('\\b(estadistica|estadisticas)\\b', 'g'), 'statistics')
        .replace(new RegExp('\\b(tabla|tablas)\\b', 'g'), 'table')
        .replace(new RegExp('\\b(boton|botones)\\b', 'g'), 'button')
        .replace(new RegExp('\\b(foro|foros)\\b', 'g'), 'forum')
        .replace(new RegExp('\\b(evento|eventos)\\b', 'g'), 'event')
        .replace(new RegExp('\\b(presentacion|presentaciones)\\b', 'g'), 'presentation')
        .replace(new RegExp('\\b(imagen|imagenes)\\b', 'g'), 'image')
        .replace(new RegExp('\\b(vendedor|vendedores)\\b', 'g'), 'seller')
        .replace(new RegExp('\\b(modulo|modulos)\\b', 'g'), 'module')
        .replace(new RegExp('\\b(grupo|grupos)\\b', 'g'), 'group')
        .replace(new RegExp('\\b(nota|notas)\\b', 'g'), 'grade')
        .replace(new RegExp('\\b(listo)\\b', 'g'), 'done')
        .replace(new RegExp('\\b(naturaleza|naturalezas)\\b', 'g'), 'nature')
        .replace(new RegExp('\\b(anuncio|anuncios)\\b', 'g'), 'announcement')
        .replace(new RegExp('\\b(asistente|asistentes)\\b', 'g'), 'assistant')
        .replace(new RegExp('\\b(basico|basicos)\\b', 'g'), 'basic');
}

function cleanInformation(document, tokenized = true) {
    //natural.PorterStemmer.attach();
    //natural.LancasterStemmer.attach();
    tokenizer = new natural.WordTokenizer();

    document = document.toLowerCase()
        .replace(new RegExp('\\w(_)\\w', 'g'), ' ')
        .replace(/\d+/g, ' ')
        .replace(new RegExp('\\b(\')\\b', 'g'), ' ')
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
