import { useEffect, useState } from "react";
import "./App.css";
import shapeToUrl from "./shapeToUrl";
import initOpenCascade from "opencascade.js";
import "@google/model-viewer";

var globOC;

const getProperties = (model, oc) => {
  var volumeProps = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(model, volumeProps, false, false, false);
  var volume = volumeProps.Mass();
  var surfaceProps = new oc.GProp_GProps_1();
  oc.BRepGProp.SurfaceProperties_1(model, surfaceProps, false, false);
  var surfaceArea = surfaceProps.Mass();
  return [volume, surfaceArea];
};

const makeTranslation = (oc, dist) => {
  const tf = new oc.gp_Trsf_1();
  var xyz = new oc.gp_XYZ_1();
  xyz.SetX(dist);
  tf.SetTranslation_1(new oc.gp_Vec_3(xyz));
  const loc = new oc.TopLoc_Location_2(tf);
  return loc;
};

function readFileFromString(file, string, oc) {
  oc.FS.createDataFile("/", `file.step`, string, true, true);
  var reader = new oc.STEPControl_Reader_1();
  const readResult = reader.ReadFile(`file.step`);
  if (readResult === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
    console.log("file loaded successfully!");
    oc.FS.unlink(`/file.step`);
    // Translate all transferable roots to OpenCascade
    const numRootsTransferred = reader.TransferRoots(new oc.Message_ProgressRange_1());
    var shape = reader.OneShape();
    return shape;
  } else {
    console.error("Something in OC went wrong with: " + file);
    return ""
  }
}

function loadModel(file, oc) {
  document.getElementById("data1").innerHTML = `Model: Loading...`
  fetch(file)
    .then(response => response.text()).then(data => {

      var shape = readFileFromString(file, data, oc);
      const [volume, area] = getProperties(shape, oc);
      // Update
      document.getElementById("gwm1").src = shapeToUrl(oc, shape);
      document.getElementById("data1").innerHTML = `Model: ${file}<br/>Area: ${area}<br/>Vol: ${volume}`;

    });
}

function loadModelUnion(model1, model2, oc) {

  document.getElementById("data1").innerHTML = `Model: Loading...`
  document.getElementById("data2").innerHTML = `Model: Loading...`

  fetch(model1).then(res => res.text()).then(data1 => {

    var shape1 = readFileFromString(model1, data1, oc);

    if (shape1 !== "") {

      fetch(model2).then(res => res.text()).then(data2 => {

        var shape2 = readFileFromString(model2, data2, oc);

        const [vol1, area1] = getProperties(shape1, oc);
        const [vol2, area2] = getProperties(shape2, oc);

        // Combine the preview with displace
        // 100 is a magic const that define displace between two models
        // can be defined more proper as cube_root(vol1) + cube_root(vol2)
        const fusePreview = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2.Moved(makeTranslation(oc, 100), false),
          new oc.Message_ProgressRange_1());
        fusePreview.Build(new oc.Message_ProgressRange_1());
        const fuseShapePreview = fusePreview.Shape();

        // Combine the result
        const fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, new oc.Message_ProgressRange_1());
        fuse.Build(new oc.Message_ProgressRange_1());
        const fuseShape = fuse.Shape();

        const [vol3, area3] = getProperties(fuseShape, oc);

        // Update
        document.getElementById("gwm1").src = shapeToUrl(oc, fuseShapePreview);
        document.getElementById("gwm2").src = shapeToUrl(oc, fuseShape);

        document.getElementById("data1").innerHTML = `Model: ${model1}<br/>Area: ${area1}<br/>Vol: ${vol1}<br/><br/>Model: ${model2}<br/>Area: ${area2}<br/>Vol: ${vol2}`;
        document.getElementById("data2").innerHTML = `Model: ${model2}<br/>Area: ${area3}<br/>Vol: ${vol3}`;

      });
    }
  });
}

function loadModelCallback(event) {
  var val = document.getElementById("models").value;
  // Strage logic
  if (val < 9) {
    loadModel(`/models/model${val}.STEP`, globOC);
  }
  else {
    // if (val === 12)
    loadModelUnion(`/models/model1.STEP`, `/models/model2.STEP`, globOC);
  }
}

function App() {
  const [modelUrl, setModelUrl] = useState();
  useEffect(() => {
    initOpenCascade().then(oc => {

      globOC = oc;
      const sphere = new oc.BRepPrimAPI_MakeSphere_1(1);

      setModelUrl(shapeToUrl(oc, sphere.Shape()));
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {modelUrl === undefined ? (
          <p>
            Loading...
          </p>
        ) : (
          <div>
            <div className="viewports">
              <div className="viewport">
                <p>Viewport 1</p>
                <model-viewer id="gwm1" class="App-viewport" src={modelUrl} camera-controls />
                <div className="data" id="data1">Data</div>
              </div>
              <div className="viewport">
                <p>Viewport 2</p>
                <model-viewer id="gwm2" class="App-viewport" src={modelUrl} camera-controls />
                <div className="data" id="data2">Data</div>
              </div>
            </div>
            <br />
            <select id="models">
              <option value="1">model1</option>
              <option value="2">model2</option>
              <option value="3">model3</option>
              <option value="4">model4</option>
              <option value="12">model1 + model2</option>
            </select>
            <button onClick={loadModelCallback}>Load</button>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
