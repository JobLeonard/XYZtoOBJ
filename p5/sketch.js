let file,
	voronoi,
	geometry,
	loadXYZfileInput,
	description,
	xyzStrings,
	xyzPoints,
	xMin, xMax, yMin, yMax, zMin, zMax,
	xyzSet,
	xyData,
	triangles,
	triangleVerticesSet,
	STLstring,
	textFile,
	saveLink;

function setup() {
	voronoi = d3.voronoi();
	
	description = createSpan('Please select the .xyz file to convert');
	description.position(windowWidth / 2 - 100, windowHeight / 2 - 50);
	
	loadXYZfileInput = createFileInput(loadXYZfile);
	loadXYZfileInput.position(windowWidth / 2 - 100, windowHeight / 2);
	
	saveLink = createA('', 'Nothing to save yet.')
	saveLink.attribute('disabled', '');
	saveLink.position(windowWidth / 2 - 100, windowHeight / 2 + 50);

	noCanvas();
	noLoop();
}


function loadXYZfile(selectedFile) {
	if (selectedFile) {
		saveLink.remove();
		saveLink = createA('', 'Nothing to save yet.')
		saveLink.attribute('disabled', '');
		saveLink.position(windowWidth / 2 - 100, windowHeight / 2 + 50);

		file = selectedFile;
		description.html('File loaded: ' + file.name + ', converting strings to coordinates')
		convertXYZ(file)
	}
}

function convertXYZ(file) {
	//console.log({ file });
	xyzStrings = window.atob(file.data.split(',')[1])
		.trim()
		// Note from text files: x and y always have one digit of precision, z always two.
		// That means we can turn them into integers, which is faster than float32 values,
		// and will especially be handy later with adding z-height back into the triangle.
		.replace(/,/gi, '.')
		.split(/[\r\n]+/g) //.split(/\s+/g)
	//console.log({ xyzStrings });

	// make file.data string GC-able, since we no longer need it
	file.data = ''

	// Abuse type coercion
	// xyzStrings.map(xyzString => +xyzString);
	// xyzPoints = Float32Array.from(xyzStrings);
	const regexWhiteSpace = /\s+/g;
	xyzPoints = xyzStrings.map((xyzString) => {
		let xyz = xyzString.split(regexWhiteSpace);
		return [+xyz[0], +xyz[1], +xyz[2]];
	});
	//console.log({ xyzPoints });

	// we no longer need xyzStrings either
	xyzStrings = null;

	xyzSet = new Set(xyzPoints);

	xMin = xMax = xyzPoints[0][0];
	yMin = yMax = xyzPoints[0][1];
	zMin = zMax = xyzPoints[0][2];
	for(let point in xyzSet){
		let x = point[0];
		let y = point[1];
		let z = point[2];
		if (x < xMin) {
			xMin = x;
		}
		if (x > xMax) {
			xMax = x;
		}
		if (y < yMin) {
			yMin = y;
		}
		if (y > yMax) {
			yMax = y;
		}
		if (z < zMin) {
			zMin = z;
		}
		if (z > zMax) {
			zMax = z;
		}
	}

	for (let point in xyzSet) {
		let x = distance(xMin, point[1], point[0], point[1]);
		let y = distance(point[0], yMin, point[0], point[1]);
		point[0] = x;
		point[1] = y;
	}


	//console.log({ xMin, xMax, yMin, yMax, zMin, zMax });

	xyData = new Array(xyzPoints.length);
	for (let i = 0; i < xyData.length; i++) {
		xyData[i] = [
			xyzPoints[i][0],
			xyzPoints[i][1],
		];
	}
	//console.log({ xyData });
	description.html('Coordinates converted, generating triangles')
	window.setTimeout(triangulate, 0);
}

const {
	cos,
	asin,
	sqrt,
} = Math;

// https://stackoverflow.com/a/21623206/3211791
function distance(lat1, lon1, lat2, lon2) {
	var p = 0.017453292519943295;    // Math.PI / 180
	var a = 0.5 - cos((lat2 - lat1) * p) / 2 +
		cos(lat1 * p) * cos(lat2 * p) *
		(1 - cos((lon2 - lon1) * p)) / 2;

	return 12742 * asin(sqrt(a)); // 2 * R; R = 6371 km
}


function triangulate() {
	triangles = voronoi(xyData).triangles();
	//console.log({ triangles });
	description.html('Triangles generated, adding height');

	// xyData is no longer needed
	xyData = null;
	window.setTimeout(addZtoTriangles, 0);
}

function addZtoTriangles() {
	let zLookup = new Map();
	for (let i = 0; i < xyzPoints.length; i++) {
		let x = xyzPoints[i][0];
		let y = xyzPoints[i][1];
		let z = xyzPoints[i][2];
		zLookup.set('x' + x + 'y' + y, z);
	}

	// Any vertex that is a duplicate will 'overwrite'
	// itself in this map, resulting in a 
	triangleVerticesSet = new Set();
	for (let j = 0; j < triangles.length; j++) {
		triangleVerticesSet.add(triangles[j][0]);
		triangleVerticesSet.add(triangles[j][1]);
		triangleVerticesSet.add(triangles[j][2]);
	}

	for (let v of triangleVerticesSet) {
		if (v.length < 3) {
			v.push(zLookup.get('x' + v[0] + 'y' + v[1]));
		}
	}

	//console.log({ triangles });
	description.html('Height added to triangles. Generating Geometry');

	// Make garbage-collectable
	xyzPoints = null;
	window.setTimeout(computeNormals, 0)
}

function computeNormals() {
	geometry = new THREE.Geometry();


	for (let i = 0; i < triangles.length; i++) {
		let ti = triangles[i];
		if (ti.length < 4) {
			let va = ti[0];
			let vb = ti[1];
			let vc = ti[2];
			geometry.vertices.push(
				new THREE.Vector3(va[0], va[1], va[2]),
				new THREE.Vector3(vb[0], vb[1], vb[2]),
				new THREE.Vector3(vc[0], vc[1], vc[2])
			);
			geometry.faces.push(new THREE.Face3(i * 3, i * 3 + 1, i * 3 + 2));
		}
	}
	geometry.normalize();
	//console.log({geometry});
	description.html('Geometry calculated, converting to STLstring');

	triangles = null;

	window.setTimeout(generateSTLstring, 0);
}

function generateSTLstring() {
	const exporter = new THREE.STLBinaryExporter();
	const mesh = new THREE.Mesh(geometry)
	STLstring = exporter.parse(mesh);
	//console.log({	})
	description.html('STLstring generated, saving file');

	geometry.dispose();
	geometry = null;
	window.setTimeout(exportSTLstring, 0);
}

function exportSTLstring() {
	// See https://stackoverflow.com/a/20812731/3211791
	var data = new Blob([STLstring], { type: 'application/octet-stream' });

	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (textFile !== null) {
		window.URL.revokeObjectURL(textFile);
	}

	// returns a URL you can use as a href
	textFile = window.URL.createObjectURL(data);

	description.html('STLstring exported as ' + file.name + '.stl.');
	saveLink.remove();
	saveLink = createA(textFile, 'Right click + save ' + file.name + '.stl')
	saveLink.attribute('download', file.name + '.stl');
	saveLink.position(windowWidth / 2 - 100, windowHeight / 2 + 50);
}