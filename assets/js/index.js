const cam = document.getElementById("cam");
const overlayCanvas = document.getElementById("overlay");
const overlayContext = overlayCanvas.getContext("2d");

navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    cam.srcObject = stream;
  })
  .catch((error) => console.error("Erro ao acessar a câmera:", error));

const startVideo = () => {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    if (Array.isArray(devices)) {
      devices.forEach((device) => {
        if (device.kind === "videoinput") {
          if (device.label.includes("GENERAL WEBCAM")) {
            navigator.mediaDevices
              .getUserMedia({ video: { deviceId: device.deviceId } })
              .then((stream) => {
                cam.srcObject = stream;
              })
              .catch((error) => console.error(error));
          }
        }
      });
    }
  });
};

const loadLabels = () => {
  const labels = ["Kézia Antero"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 3; i++) {
        const img = await faceapi.fetchImage(
          `/assets/lib/face-api/labels/${label}/${i}.jpg`
        );
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
};

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.ageGenderNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/assets/lib/face-api/models"),
]).then(startVideo);

const translateExpression = (expression) => {
  const expressionMap = {
    neutral: "Neutro",
    happy: "Feliz",
    sad: "Triste",
    angry: "Bravo",
    fearful: "Com medo",
    disgusted: "Enojado",
    surprised: "Surpreso",
  };
  return expressionMap[expression] || expression;
};

cam.addEventListener("play", async () => {
  const canvasSize = { width: cam.width, height: cam.height };
  const labels = await loadLabels();

  overlayCanvas.width = cam.width;
  overlayCanvas.height = cam.height;

  faceapi.matchDimensions(overlayCanvas, canvasSize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(cam, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, canvasSize);
    const faceMatcher = new faceapi.FaceMatcher(labels, 0.6);
    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Atualiza os dados da div para o primeiro rosto detectado (caso queira exibir apenas o primeiro rosto)
    if (resizedDetections.length > 0) {
      const detection = resizedDetections[0];
      const { age, gender, expressions } = detection;
      const result = results[0];
      const identification =
        result.label !== "unknown" ? result.label : "Desconhecido";

      const maxExpression = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );

      const expressionInPortuguese = translateExpression(maxExpression);

      // Atualizar os elementos HTML na div
      document.getElementById("identification").innerText = identification;
      document.getElementById("age").innerText = `${parseInt(age, 10)} anos`;
      document.getElementById("gender").innerText =
        gender === "male" ? "Masculino" : "Feminino";
      document.getElementById("state").innerText = expressionInPortuguese;
    }

    resizedDetections.forEach((detection, index) => {
      const { age, gender, expressions } = detection;
      const result = results[index];
      const identification =
        result.label !== "unknown" ? result.label : "Desconhecido";

      const maxExpression = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );

      const expressionInPortuguese = translateExpression(maxExpression);
      const textLines = [
        `Emoção: ${expressionInPortuguese}`,
        `Gênero: ${gender === "male" ? "Masculino" : "Feminino"}`,
        `Idade: ${parseInt(age, 10)} anos`,
        `ID: ${identification}`,
      ];

      const box = detection.detection.box;
      const textX = box.x + box.width + 10;
      const textY = box.y;

      overlayContext.strokeStyle = "#13FF19";
      overlayContext.lineWidth = 2;
      overlayContext.strokeRect(box.x, box.y, box.width, box.height);

      faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);

      overlayContext.font = "12px 'Courier New'";
      overlayContext.fillStyle = "#13FF19";

      textLines.forEach((line, i) => {
        overlayContext.fillText(line, textX, textY + 20 * i);
      });
    });
  }, 100);
});


