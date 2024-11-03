import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

import * as Base64 from "./base64.js";

var detections = [];
var imgSaveRequested = 0;

window.onload = (event) => {
  init();


}

async function init() {
  // WebWorkers use `postMessage` and therefore work with Comlink.
  const Apriltag = Comlink.wrap(new Worker("apriltag.js"));

  // must call this to init apriltag detector; argument is a callback for when the detector is ready
  window.apriltag = await new Apriltag(Comlink.proxy(() => {

    // set camera info; we must define these according to the device and image resolution for pose computation
    //window.apriltag.set_camera_info(double fx, double fy, double cx, double cy)

    window.apriltag.set_tag_size(5, .5);

    // start processing frames
    window.requestAnimationFrame(process_frame);
  }));

  // get the table name from url parameters
  let table_name = getURLParameter('table')

  async function getStudents() {
    const backendURL = "http://localhost:6969"
    const response = await fetch(`${backendURL}/students?table=${table_name}`);
    const data = await response.json();
    return data;
  }

  let students = await getStudents();

  // dummy data below
  // let students = [
  //   {
  //     "id": 1,
  //     "name": "John Doe",
  //     "srn": "PES2UG22CS121",
  //     "prn": "PES2202200294",
  //     "detected": false
  //   },
  //   {
  //     "id": 2,
  //     "name": "Jane Doe",
  //     "srn": "PES2UG22CS209",
  //     "prn": "PES2202200293",
  //     "detected": false
  //   },
  //   {
  //     "id": 3,
  //     "name": "John Doe Another One",
  //     "srn": "PES2UG22CS122",
  //     "prn": "PES2202200295",
  //     "detected": false
  //   },
  // ]

  // students is an array with json objects of the form:
  // {
  //   "id": 1,
  //   "name": "John Doe",
  //   "srn": "PES2UG22CS121",
  //   "prn": "PES2202200294"
  //   "detected": false
  // }
  window.students = students;
}


function getURLParameter(sParam) {
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++) {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) {
      return sParameterName[1];
    }
  }
}

async function process_frame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  let ctx = canvas.getContext("2d");

  let imageData;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  } catch (err) {
    console.log("Failed to get video frame. Video not started ?");
    setTimeout(process_frame, 500); // try again in 0.5 s
    return;
  }
  let imageDataPixels = imageData.data;
  let grayscalePixels = new Uint8Array(ctx.canvas.width * ctx.canvas.height); // this is the grayscale image we will pass to the detector

  for (var i = 0, j = 0; i < imageDataPixels.length; i += 4, j++) {
    let grayscale = Math.round((imageDataPixels[i] + imageDataPixels[i + 1] + imageDataPixels[i + 2]) / 3);
    grayscalePixels[j] = grayscale; // single grayscale value
    imageDataPixels[i] = grayscale;
    imageDataPixels[i + 1] = grayscale;
    imageDataPixels[i + 2] = grayscale;
  }
  ctx.putImageData(imageData, 0, 0);

  // draw previous detection
  detections.forEach(det => {
    // draw tag borders
    ctx.beginPath();
    ctx.lineWidth = "5";
    ctx.strokeStyle = "red";
    ctx.moveTo(det.corners[0].x, det.corners[0].y);
    ctx.lineTo(det.corners[1].x, det.corners[1].y);
    ctx.lineTo(det.corners[2].x, det.corners[2].y);
    ctx.lineTo(det.corners[3].x, det.corners[3].y);
    ctx.lineTo(det.corners[0].x, det.corners[0].y);
    ctx.font = "bold 20px Arial";
    var txt = window.students[det.id - 1].name
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.fillText(txt, det.center.x, det.center.y + 5);
    ctx.stroke();
    if (!window.students[det.id - 1].detected) {
      window.students[det.id - 1].detected = true;
    }
  });

  // detect aprilTag in the grayscale image given by grayscalePixels
  detections = await apriltag.detect(grayscalePixels, ctx.canvas.width, ctx.canvas.height);
  window.requestAnimationFrame(process_frame);
}


var button = document.getElementById('get_absentees');
button.addEventListener('click', function() {
  getAbsentees();
});

function getAbsentees() {
  let absentees = window.students.filter(student => student.detected === false);
  // sort absentees by srn
  absentees.sort((a, b) => (a.srn > b.srn) ? 1 : -1);
  console.log("Absentees: ", absentees);
  let absenteesList = document.getElementById('absentees');
  absenteesList.innerHTML = "";
  const num_absentees = absentees.length;
  const num_students_total = window.students.length;
  absenteesList.appendChild(document.createTextNode("ABSENTEES: " + num_absentees + "/" + num_students_total))
  absenteesList.appendChild(document.createElement('br'));
  absentees.forEach(student => {
    let listItem = document.createElement('li');
    listItem.textContent = student.name + " (" + student.srn + ")";
    absenteesList.appendChild(listItem);
  });
}

