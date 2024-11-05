const cam = document.getElementById("cam");
const overlayCanvas = document.getElementById("overlay");
const overlayContext = overlayCanvas.getContext("2d");


const startVideo = () => {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      cam.srcObject = stream;
    })
    .catch((error) => console.error("Erro ao acessar a câmera:", error));
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

        // Verifique se a detecção é válida
        if (detections && detections.descriptor) {
          descriptions.push(detections.descriptor);
        } else {
          console.warn(`Rosto não detectado na imagem ${label}/${i}.jpg`);
        }
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
]).then(() => {
  console.log("Modelos carregados com sucesso");
  startVideo();
});


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

  const faceMatcher = new faceapi.FaceMatcher(labels, 0.6);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(cam, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, canvasSize);
    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    resizedDetections.forEach((detection) => {
      const { age, gender, expressions, descriptor } = detection;
      const bestMatch = faceMatcher.findBestMatch(descriptor);
      const identification =
        bestMatch.label !== "unknown" ? bestMatch.label : "Desconhecido";

      const maxExpression = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );
      const expressionInPortuguese = translateExpression(maxExpression);

      document.getElementById("identification").innerText = identification;
      document.getElementById("age").innerText = `${parseInt(age, 10)} anos`;
      document.getElementById("gender").innerText =
        gender === "male" ? "Masculino" : "Feminino";
      document.getElementById("state").innerText = expressionInPortuguese;

      const box = detection.detection.box;
      overlayContext.strokeStyle = "#13FF19";
      overlayContext.lineWidth = 2;
      overlayContext.strokeRect(box.x, box.y, box.width, box.height);

      overlayContext.font = "12px 'Courier New'";
      overlayContext.fillStyle = "#13FF19";

      const textLines = [
        `Emoção: ${expressionInPortuguese}`,
        `Gênero: ${gender === "male" ? "Masculino" : "Feminino"}`,
        `Idade: ${parseInt(age, 10)} anos`,
        `ID: ${identification}`,
      ];
      const textX = box.x;
      const textY = box.y + box.width + 10;
      textLines.forEach((line, i) => {
        overlayContext.fillText(line, textX, textY + 20 * i);
      });

      faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);
    });
  }, 100);
});
