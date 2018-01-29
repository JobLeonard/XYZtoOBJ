let file,
	voronoi,
	geometry,
	loadXYZfileInput,
	description,
	xyzStrings = [''],
	maxDataLength = 1000000000, // amount of vertices before we sub-divide
	xyzPointsInt = [
		{
			data: [[0]],
			xIdx: 0,
			yIdx: 0,
		},
	],
	xyzPointsFloat = [
		{
			data: [[0.0]],
			xIdx: 0,
			yIdx: 0,
		}
	],
	triangles = [{
		data: [[[0, 0, 0], [0, 0, 0], [0, 0, 0]]],
		xIdx: 0,
		yIdx: 0,
	}],
	STLstring = [],
	textFile = [],
	saveLink = [];

function setup() {
	// @ts-ignore
	voronoi = d3.voronoi();

	description = createSpan('Please select the .xyz file to convert');
	description.position(windowWidth / 2 - 100, windowHeight / 2 - 50);

	loadXYZfileInput = createFileInput(loadXYZfile);
	loadXYZfileInput.position(windowWidth / 2 - 100, windowHeight / 2);

	saveLink[0] = createA('', 'Nothing to save yet.')
	saveLink[0].attribute('disabled', '');
	saveLink[0].position(windowWidth / 2 - 100, windowHeight / 2 + 50);

	noCanvas();
	noLoop();
}


function loadXYZfile(selectedFile) {
	if (selectedFile) {
		for (let i = 0; i < saveLink.length; i++) {
			saveLink[i].remove();
		}
		saveLink[0] = createA('', 'Nothing to save yet.')
		saveLink[0].attribute('disabled', '');
		saveLink[0].position(windowWidth / 2 - 100, windowHeight / 2 + 50);

		file = selectedFile;
		description.html('File loaded: ' + file.name + ', converting strings to coordinates')
		convertXYZ(file)
	}
}

function convertXYZ(file) {
	//console.log({ file });
	xyzStrings = window.atob(file.data.split(',')[1]) //Translate the Base64 string to plain text
		.trim() // Remove trailing whitespace
		// Based on the xyz files, x and y always have one digit of precision, z always two.
		// That means we can turn them into integers, which is faster than float32 values,
		// potentially it a lot easier to quickly sort them later on.
		.replace(/,/gi, '') // remove comma, turn values into strings of integers
		.split(/[\r\n]+/g)  // split by line to create strings of individual xyz-coordinates
	//console.log({ xyzStrings });

	// make file.data string GC-able, since we no longer need it
	// (Name will be used later however)
	file.data = ''



	// ==== Array of arrays
	xyzToNestedArray()
	//console.log({ xMin, xMax, yMin, yMax, zMin, zMax });

	//console.log({ xyData });
	description.html('Coordinates divided, converting to float')
	window.setTimeout(convertLatLon, 0);
}

function xyzToNestedArray() {
	const regexWhiteSpace = /\s+/g;
	let data = xyzStrings.map((xyzString) => {
		let xyz = xyzString.split(regexWhiteSpace);
		return [
			// abuse type coercion
			xyz[0] | 0,
			xyz[1] | 0,
			xyz[2] | 0
		];
	});


	let xyzPointsIntTree = {
		data,
		xIdx: 0,
		yIdx: 0,
	};

	//console.log({ xyzPointsInt });

	// we no longer need xyzStrings
	xyzStrings = null;

	// recursively split
	if (data.length > maxDataLength) {
		xyzPointsInt = [];
		splitByX(xyzPointsIntTree);
	} else {
		xyzPointsInt = [xyzPointsIntTree];
	}
}

function findMinMax(data) {
	let xMin = data[0][0], xMax = xMin;
	let yMin = data[0][1], yMax = yMin;
	let zMin = data[0][2], zMax = zMin;
	for (let i = 1; i < data.length; i++) {
		let point = data[i];
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
	return {
		xMin,
		xMax,
		yMin,
		yMax,
		zMin,
		zMax,
	};
}

function splitByX(node) {
	const { data, xIdx, yIdx, } = node;
	data.sort(sortNestedByX);
	const midpointX = data[data.length / 2 | 0][0];
	let leftData = [], rightData = [];

	// split into two datasets
	for (let i = 0; i < data.length; i++) {
		let point = data[i],
			x = point[0];
		if (x <= midpointX) {
			leftData.push(point);
		}
		if (x >= midpointX) {
			rightData.push(point);
		}
	}

	// created sub-nodes
	const left = {
		data: leftData,
		xIdx: xIdx * 2 + 0,
		yIdx,
	}
	const right = {
		data: rightData,
		xIdx: xIdx * 2 + 1,
		yIdx,
	}

	if ((data.length / 2 | 0) < maxDataLength) {
		xyzPointsInt.push(left);
		xyzPointsInt.push(right);
	} else {
		splitByY(left);
		splitByY(right);
	}
}

function splitByY(node) {
	const { data, xIdx, yIdx, } = node;
	data.sort(sortNestedByY);
	const midpointY = data[data.length / 2 | 0][1];
	let leftData = [], rightData = [];

	// split into two datasets
	for (let i = 0; i < data.length; i++) {
		let point = data[i],
			y = point[1];
		if (y <= midpointY) {
			leftData.push(point);
		}
		if (y >= midpointY) {
			rightData.push(point);
		}
	}

	// created sub-nodes
	const left = {
		data: leftData,
		xIdx,
		yIdx: yIdx * 2 + 0,
	}
	const right = {
		data: rightData,
		xIdx,
		yIdx: yIdx * 2 + 1,
	}

	if ((data.length / 2 | 0) < maxDataLength) {
		xyzPointsInt.push(left);
		xyzPointsInt.push(right);
	} else {
		splitByX(left);
		splitByX(right);
	}
}

function sortNestedByX(pi, pj) {
	let xi = pi[0];
	let yi = pi[1];
	let zi = pi[2];
	let xj = pj[0];
	let yj = pj[1];
	let zj = pj[2];
	return xi - xj ? xi - xj :
		yi - yj ? yi - yj :
			zi - zj ? zi - zj : 0;
}
function sortNestedByY(pi, pj) {
	let xi = pi[0];
	let yi = pi[1];
	let zi = pi[2];
	let xj = pj[0];
	let yj = pj[1];
	let zj = pj[2];
	return yi - yj ? yi - yj :
		xi - xj ? xi - xj :
			zi - zj ? zi - zj : 0;
}

function convertLatLon() {
	// Convert lat/lon coordinates to x,y positions
	xyzPointsFloat = new Array(xyzPointsInt.length);
	for (let i = 0; i < xyzPointsInt.length; i++) {
		let points = xyzPointsInt[i];
		let { data, xIdx, yIdx } = points;
		let {
			xMin,
			xMax,
			yMin,
			yMax,
			zMin,
			zMax,
		} = findMinMax(data);
		const convertedXmin = distance(0, 0, xMin, 0);
		const convertedYmin = distance(0, 0, 0, yMin);
		let convertedData = new Array(data.length);
		for (let j = 0; j < data.length; j++) {
			let point = data[j];
			let x = (point[0] | 0) / 10;
			let y = (point[1] | 0) / 10;
			let z = (point[2] | 0) / 100;
			// x = distance(0, y, x, y) - convertedXmin;
			// y = distance(x, 0, x, y) - convertedYmin;
			convertedData[j] = [x, y, z];
		}
		xyzPointsFloat[i] = {
			data: convertedData,
			xIdx,
			yIdx,
		};
	}

	xyzPointsInt = null;
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
	triangles = new Array(xyzPointsFloat.length);
	for (let i = 0; i < xyzPointsFloat.length; i++) {
		let points = xyzPointsFloat[i];
		let {
			data,
		} = points;
		let xyData = new Array(data.length);
		for (let j = 0; j < xyData.length; j++) {
			xyData[j] = [
				data[j][0],
				data[j][1],
			];
		}
		let triangleData = voronoi(xyData).triangles();
		triangles[i] = Object.assign({}, points, { data: triangleData });
	}
	//console.log({ triangles });
	description.html('Triangles generated, forcing clockwise path');

	window.setTimeout(makeAllTrianglesClockwise, 0);
}

function makeAllTrianglesClockwise() {
	for (let i = 0; i < triangles.length; i++) {
		let { data } = triangles[i];
		for (let j = 0; j < data.length; j++) {
			let triangle = data[j],
				p0 = triangle[0],
				p1 = triangle[1],
				p2 = triangle[2];
			let xSum = p0[0] + p1[0] + p2[0];
			let ySum = p0[1] + p1[1] + p2[1];
			xSum /= 3;
			ySum /= 3;
			let sortedTriangle = [
				{ p: p0, a: atan2(p0[0] - ySum, p0[1] - xSum) },
				{ p: p1, a: atan2(p1[0] - ySum, p1[1] - xSum) },
				{ p: p2, a: atan2(p2[0] - ySum, p2[1] - xSum) },
			].sort(sortAngle);
			triangle[0] = sortedTriangle[0].p;
			triangle[1] = sortedTriangle[1].p;
			triangle[2] = sortedTriangle[2].p;
		}
	}

	description.html('Triangles set to clockwise orientation, adding height');
	window.setTimeout(addZtoTriangles, 0);
}

function sortAngle(i, j) {
	return PI + i.a - j.a;
}

function addZtoTriangles() {
	for (let i = 0; i < xyzPointsFloat.length; i++) {
		let { data } = xyzPointsFloat[i];
		let zLookup = new Map();
		for (let j = 0; j < data.length; j++) {
			let point = data[j]
			let x = point[0];
			let y = point[1];
			let z = point[2];
			zLookup.set('x' + x + 'y' + y, z);
		}

		// Any vertex that is a duplicate will 'overwrite'
		// itself in this map, resulting in a 
		let triangleVerticesSet = new Set();
		let triangleData = triangles[i].data;
		for (let j = 0; j < triangleData.length; j++) {
			triangleVerticesSet.add(triangleData[j][0]);
			triangleVerticesSet.add(triangleData[j][1]);
			triangleVerticesSet.add(triangleData[j][2]);
		}

		for (let v of triangleVerticesSet) {
			if (v.length < 3) {
				v.push(zLookup.get('x' + v[0] + 'y' + v[1]));
			}
		}
	}
	//console.log({ triangles });
	description.html('Height added to triangles. Generating Geometry');

	// Make garbage-collectable
	xyzPointsFloat = null;
	window.setTimeout(computeNormals, 0)
}

function computeNormals() {
	geometry = [];
	for (let i = 0; i < triangles.length; i++) {
		let trianglesData = triangles[i].data;
		let geometryData = new THREE.Geometry();
		for (let j = 0; j < trianglesData.length; j++) {
			let ti = trianglesData[j];
			if (ti.length < 4) {
				let va = ti[0];
				let vb = ti[1];
				let vc = ti[2];
				geometryData.vertices.push(
					new THREE.Vector3(va[0], va[1], va[2]),
					new THREE.Vector3(vb[0], vb[1], vb[2]),
					new THREE.Vector3(vc[0], vc[1], vc[2])
				);
				geometryData.faces.push(new THREE.Face3(j * 3, j * 3 + 1, j * 3 + 2));
			}
		}
		geometryData.center();
		geometryData.computeFaceNormals();
		geometry.push(Object.assign({}, triangles[i], { data: geometryData }));
	}
	//console.log({geometry});
	description.html('Geometry calculated, converting to STLstring');

	triangles = null;

	window.setTimeout(generateSTLstring, 0);
}

function generateSTLstring() {
	STLstring = [];
	for (let i = 0; i < geometry.length; i++) {
		let { data } = geometry[i];
		const exporter = new THREE.STLBinaryExporter();
		const mesh = new THREE.Mesh(data);
		STLstring.push(Object.assign(
			{},
			geometry[i],
			{ data: exporter.parse(mesh) }
		));
		data.dispose();
	}
	geometry = null;
	description.html('STLstring generated, saving file');
	window.setTimeout(exportSTLstring, 0);
}

function exportSTLstring() {
	if (textFile && textFile.length) {
		for (let i = 0; i < textFile.length; i++) {
			// If we are replacing a previously generated file we need to
			// manually revoke the object URL to avoid memory leaks.
			if (textFile[i] !== null) {
				window.URL.revokeObjectURL(textFile[i]);
			}
		}
	}

	if (saveLink && saveLink.length) {
		for (let i = 0; i < saveLink.length; i++) {
			saveLink[i].remove();
		}
	}

	textFile = [];
	saveLink = [];

	for (let i = 0; i < STLstring.length; i++) {
		const {
			data,
			xIdx,
			yIdx,
		} = STLstring[i]
		// See https://stackoverflow.com/a/20812731/3211791
		let filedata = new Blob([data], { type: 'application/octet-stream' });


		// returns a URL you can use as a href
		textFile[i] = window.URL.createObjectURL(filedata);

		let filename = `${file.name.split('.')[0]}.stl`
		description.html('STLstring exported as ' + filename);
		saveLink[i] = createA(textFile[i], 'Right click + save ' + filename)
		saveLink[i].attribute('download', filename);
		saveLink[i].position(windowWidth / 2 - 100, windowHeight / 2 + 50 + i * 25);
	}
}