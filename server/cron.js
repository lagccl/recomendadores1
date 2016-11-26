// import {Meteor} from "meteor/meteor";
// import Snoocore from "snoocore";
// import moment from "moment";
// import request from "request";
// import htmlToText from "html-to-text";
// import natural from "natural";
// import {Post} from "../imports/api/posts";
//
// export function syncRedit(start = moment().unix(), end = moment().subtract(6, 'months').unix()) {
//     var reddit = new Snoocore({
//         userAgent: '/u/psanabriaUC SmartBoardCronTask@1.0',
//         throttle: 300,
//         oauth: {
//             type: 'script',
//             key: 'Zz4PF6vidrfTQw',
//             secret: 'ylQMyWu7g9b346T6_qkAGyJQmi0',
//             username: 'psanabriaUC',
//             password: '"bY5Z#mgL.sp+Pe,'
//         }
//     });
//
//     var timestamp = "timestamp:" + end + ".." + start;
//     natural.LancasterStemmer.attach();
//     readPages(reddit('/r/androiddev/search')
//             .listing({limit: 100, sort: 'new', q: timestamp, syntax: 'cloudsearch', restrict_sr: 'on'}), 10,
//         Meteor.bindEnvironment((slice) => {
//             slice.allChildren.forEach((child) => {
//                 var post = new Post();
//                 post.id = child.data.id;
//                 post.title = child.data.title;
//                 post.url = child.data.url;
//                 post.created_at = new Date(child.data.created_utc * 1000);
//
//                 if (child.data.is_self) {
//                     post.text = child.data.selftext;
//                     post.words = post.text.tokenizeAndStem();
//                     if (Post.collection.findOne({_id: post.id}) != null) {
//                         Post.collection.update({_id: post.id}, post);
//                     } else {
//                         Post.collection.insert(post);
//                     }
//                 } else {
//                     retrieveTextFromPost(post);
//                 }
//             });
//         }));
// }
//
// function readPages(promise, pagesCount, action) {
//     promise.then((slice) => {
//         if (pagesCount > 0 && slice.allChildren.length > 0) {
//             action(slice);
//             readPages(slice.next(), pagesCount - 1, action);
//         } else {
//             console.log("List finished");
//         }
//     }).catch((error) => {
//         console.error("Error processing page: " + error);
//     });
// }
//
// function retrieveTextFromPost(post) {
//     request({url: post.url}, Meteor.bindEnvironment((error, response, body) => {
//         if (response == undefined || response.headers['content-type'] == undefined) {
//             console.log("Bad response?: " + (response == undefined ? "No headers" : response.headers.toString()));
//             console.log("Error: " + error);
//             return;
//         }
//
//         if (response.headers['content-type'].match(/text/)) {
//             post.text = htmlToText.fromString(body, {
//                 wordwrap: 130
//             });
//             post.words = post.text.tokenizeAndStem();
//             if (Post.collection.findOne({_id: post.id}) != null) {
//                 Post.collection.update({_id: post.id}, post);
//             } else {
//                 Post.collection.insert(post);
//             }
//         } else {
//             console.log('Skipping, not a parseable URL ' + post.url);
//         }
//     }));
// }