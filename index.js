const serverless = require("serverless-http");
const express = require("express");
const tempfile = require('tempfile');
const app = express();
// const { promisify } = require("util");
// const { join } = require("path");
const aws = require("aws-sdk");
const fluentffmpeg = require("fluent-ffmpeg");
const ffmpegPath = '/opt/nodejs/ffmpeg'
const ffprobePath = '/opt/nodejs/ffprobe'
const fs = require("fs");
const { url } = require("inspector");

fluentffmpeg.setFfmpegPath(ffmpegPath);
fluentffmpeg.setFfprobePath(ffprobePath);

const S3 = new aws.S3();

const BUCKET_ORIGIN = "ftpbucket131441-dev";
const BUCKET_THUMBNAIL = "generatethumbnailsnew";

const TEMP_DIR = tempfile();
console.log("new-bucket");


module.exports.handler = async (event, context, done) => {


  console.log(event)
  console.log("VideoResizeLambda Called ");

  var message =
    "backupapp31f55cd261a044c787af35483af5770021627-backup,public/+923215271610/Photos/onlyphonenumbersignupsigninamplify.png";

  console.log("Message received from SNS:", message);

  const key = decodeURIComponent(event.Records[0].s3.object.key).replace(
    /\+/,
    " "
  );

  console.log(event.Records[0].s3.object.key)
  console.log("This is the key",key)
  const parts = key.split("/");
  const filename = parts[parts.length - 1];
  const timestamps = ["5%", "20%"];
  console.log('typeof',typeof url)

  try {
    const url = S3.getSignedUrl("getObject", {
      Bucket: BUCKET_ORIGIN,
      Key: key,
      Expires: 60,
    });
    console.log('This is the url',url)
    const { name, ext } = toJSONFile(filename);
    const filenames = timestamps.map((_, index) =>
      getTempThumbnailFile({ index: index + 1, filename: name, ext: "png" })
    );
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log("on the way","hello one")
    await createThumbnail({ url, filename: name, timestamps, dest: TEMP_DIR });
    await Promise.all(
      filenames.map((file) =>
        saveToS3({
          bucket: BUCKET_THUMBNAIL,
          from: file.path,
          to: file.name,
        })
      )
    );  

    done(null, { success: true });
  } catch (error) {
    done(error);
  }
};



function createThumbnail({url,filename,ext = ".png",timestamps,dest = TEMP_DIR} = {}) {
  //
  //

      return new Promise((resolve, reject) => {
       fluentffmpeg(url).on("filenames", function (filenames) {
        console.log("Will generate " + filenames.join(", "));
        
    }).on("end", ()=>  {
      console.log("Processing finished!");
      resolve();
      
    }).on("error", (error) => {
      console.log("Error during processing", error);
      reject(error);
    }).screenshots({count: 3,timestamps,filename: `${filename}_%i${ext}`,folder: dest,size: '320x240'})
      
     
  })
}

function getTempThumbnailFile({ index, filename, ext }) {
  const name = `${filename}_${index}.${ext}`;

  return {
    path: `${TEMP_DIR}/${name}`,
    name,
  };
}

function saveToS3({ bucket, from, to }) {
  return S3.putObject({
    Body: fs.readFileSync(from),
    Bucket: bucket, 
    Key: to,
  }).promise();
}

function toJSONFile(filename) {
  const result = { name: filename, ext: "" };
  const matched = filename.match(/([\w-/]+)(.[A-Za-z0-9]+)/);

  return matched
    ? Object.assign(result, { name: matched[1], ext: matched[2] })
    : result;
}


