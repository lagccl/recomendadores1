import {Meteor} from "meteor/meteor";
import XmlStream from "xml-stream";
import {TfIdf} from "natural";
import htmlToText from "html-to-text";
import fs from "fs";
import {Posts} from "../imports/api/posts";

export function readStackExchangeXML(file) {
    let path = Assets.absoluteFilePath(file);
    let stream = fs.createReadStream(path);

    let xml = new XmlStream(stream);

    xml.on('endElement: row', Meteor.bindEnvironment((item) => {
        if (item['$']['PostTypeId'] == "1") {
            let post = {};

            post._id = item['$']['Id'];
            post.created_at = new Date(item['$']['CreationDate']);
            post.title = item['$']['Title'];
            post.text = item['$']['Body'];
            post.origin = Posts.stackExchange;
            post.text = htmlToText.fromString(item['$']['Body'], {
                wordwrap: 130
            });

            if (Posts.findOne({_id: post.id}) != null) {
                Posts.update({_id: post.id}, post);
            } else {
                Posts.insert(post);
            }
        }
    }));

    xml.on('end', Meteor.bindEnvironment(() => {
        console.log("End parsing XML");
        processTfIdf();
    }));
}

function processTfIdf() {
    let tfidf = new TfIdf();
    let posts = [];
    Posts.find({}).forEach((post) => {
        tfidf.addDocument(`${post.title}\n${post.text}`);
        posts.push(post);
    });
    console.log('Calculating tf-idf');
    for (let i = 0; i < posts.length; i++) {
        tfidf.listTerms(i).forEach((item) => {
            posts[i].tfs[item.term] = TfIdf.tf(item.term, tfidf.documents[i]);
            posts[i].tfidfs[item.term] = item.tfidf;
            posts[i].idfs[item.term] = tfidf.idf(item.term);
        });
        Posts.update({_id: posts[i]._id}, posts[i]);
    }
    console.log("Finished to calculate tf-idf");
}
