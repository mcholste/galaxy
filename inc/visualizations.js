function key_as_string(datum){
  if (typeof(datum.key_as_string) !== 'undefined') return datum.key_as_string;
  return datum.key;
}

function build_c3_bar_chart(data){
  for (var k in data.results.aggregations){
    // We have a special function for date histograms
    if (k === 'date_histogram') continue;
    var new_el = document.createElement('div');
    new_el.id = 'histogram_' + k;
    $('#viz_container').append(new_el);
    var columns = [];
    for (var i = 0, len = data.results.aggregations[k].buckets.length; i < len; i++){
      console.log('bucket', data.results.aggregations[k].buckets[i]);

      var col = [ 
        key_as_string(data.results.aggregations[k].buckets[i]),
        data.results.aggregations[k].buckets[i].doc_count
      ];
      columns.push(col);
    }
    console.log('columns', columns);
    var chart = c3.generate({
      bindto: new_el,
      data: {
        columns: columns,
        type: 'bar'
      }
    });
    console.log('chart', chart);
  }
}

function build_bar_chart(result_data){
  if (typeof(result_data.results.aggregations) === 'undefined') return;
  console.log('building bar chart with ', data);
  var data = [];
  for (var i = 0, len = result_data.results.aggregations.date_histogram.buckets.length; i < len; i++){
    var item = result_data.results.aggregations.date_histogram.buckets[i];
    console.log('bucket', item);
    data.push({
      date: new Date(item.key),
      count: item.doc_count
    });
  }
  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
      width = 960 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;

  // parse the date / time
  var parseDate = d3.timeParse("%Y-%d-%mT%H:%M:%SZ");

  // set the ranges
  var min_time = new Date(d3.min(data, function(d){ return new Date(d.date).getTime()}));
  var max_time = new Date(d3.max(data, function(d){ return new Date(d.date).getTime()}));
  var x = d3.scaleTime()
    .domain([min_time, max_time])
    .rangeRound([0, width]);
  var y = d3.scaleLinear()
    .range([height, 0]);

  // set the parameters for the histogram
  var tick_unit = d3.timeSecond;
  var time_range = (max_time - min_time)/1000;
  var min_ticks = 100;
  if (time_range / 86400 * 30 > min_ticks) tick_unit = d3.timeMonth;
  else if (time_range / 86400 > min_ticks) tick_unit = d3.timeDay;
  else if (time_range / 3600 > min_ticks) tick_unit = d3.timeHour;
  else if (time_range / 60 > min_ticks) tick_unit = d3.timeMinute;
  var histogram = d3.histogram()
      .value(function(d) { return d.date; })
      .domain(x.domain())
      .thresholds(x.ticks(tick_unit));

  // append the svg object to the body of the page
  // append a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  var svg = d3.select("#histogram_container").append("svg")
    .attr("width", width)// + margin.left + margin.right)
    .attr("height", height)// + margin.top + margin.bottom)
  .append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

  // format the data
  // data.forEach(function(d) {
  //   d.date = parseDate(d.date);
  // });

  // group the data for the bars
  var bins = histogram(data);

  // Scale the range of the data in the y domain
  y.domain([0, d3.max(data, function(d) { return d.count; })]);

  // append the bar rectangles to the svg element
  svg.selectAll("rect")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", 1)
      .attr("transform", function(d) {
        return "translate(" + x(d.date) + "," + y(d.count) + ")"; })
      .attr("width", function(d) { return x(d.date); })
      .attr("height", function(d) { return height - y(d.count); });

  // add the x Axis
  svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  // add the y Axis
  svg.append("g")
      .call(d3.axisLeft(y));

}

function build_line_chart(result_data){
  $('#histogram_container').empty();
  if (typeof(result_data.results.aggregations) === 'undefined' ||
    typeof(result_data.results.aggregations.date_histogram) === 'undefined') return;
  console.log('building histo with ', data);
  var data = [];
  for (var i = 0, len = result_data.results.aggregations.date_histogram.buckets.length; i < len; i++){
    var item = result_data.results.aggregations.date_histogram.buckets[i];
    console.log('bucket', item);
    data.push({
      date: new Date(item.key),
      count: item.doc_count
    });
  }
  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
      width = $('#histogram_container').width() - margin.left - margin.right,
      height = 300 - margin.top - margin.bottom;

  // parse the date / time
  var parseDate = d3.timeParse("%Y-%d-%mT%H:%M:%SZ");

  // set the ranges
  var min_time = new Date(d3.min(data, function(d){ return new Date(d.date).getTime()}));
  var max_time = new Date(d3.max(data, function(d){ return new Date(d.date).getTime()}));
  var x = d3.scaleTime()
    .domain([min_time, max_time])
    .rangeRound([0, width]);
  var y = d3.scaleLinear()
    .range([height, 0]);

  var line = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.count); });

  x.domain(d3.extent(data, function(d) { return d.date; }));
  y.domain(d3.extent(data, function(d) { return d.count; }));

  var svg = d3.select("#histogram_container").append("svg")
    .attr('class', 'linechart')
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");
  

  svg.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  svg.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("class", "axis-title")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Price ($)");

  svg.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", line);

}

function build_histogram(result_data){
  if (typeof(result_data.results.aggregations) === 'undefined' ||
    typeof(result_data.results.aggregations.date_histogram) === 'undefined') return;
  console.log('building histo with ', data);
  var data = [];
  for (var i = 0, len = result_data.results.aggregations.date_histogram.buckets.length; i < len; i++){
    var item = result_data.results.aggregations.date_histogram.buckets[i];
    console.log('bucket', item);
    data.push({
      date: new Date(item.key),
      count: item.doc_count
    });
  }
  // set the dimensions and margins of the graph
  var margin = {top: 10, right: 30, bottom: 30, left: 40},
      width = 960 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;
  console.log('histo width ' + width);

  // parse the date / time
  var parseDate = d3.timeParse("%Y-%d-%mT%H:%M:%SZ");

  // set the ranges
  var min_time = new Date(d3.min(data, function(d){ return new Date(d.date).getTime()}));
  var max_time = new Date(d3.max(data, function(d){ return new Date(d.date).getTime()}));
  var x = d3.scaleTime()
    .domain([min_time, max_time])
    .rangeRound([0, width]);
  var y = d3.scaleLinear()
    .range([height, 0]);

  // set the parameters for the histogram
  var tick_unit = d3.timeSecond;
  var time_range = (max_time - min_time)/1000;
  var min_ticks = 100;
  if (time_range / 86400 * 30 > min_ticks) tick_unit = d3.timeMonth;
  else if (time_range / 86400 > min_ticks) tick_unit = d3.timeDay;
  else if (time_range / 3600 > min_ticks) tick_unit = d3.timeHour;
  else if (time_range / 60 > min_ticks) tick_unit = d3.timeMinute;
  var histogram = d3.histogram()
      .value(function(d) { return d.date; })
      .domain(x.domain())
      .thresholds(x.ticks(tick_unit));

  // append the svg object to the body of the page
  // append a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  var svg = d3.select("#histogram_container").append("svg")
    .attr('width', '100%')
    //.attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

  // format the data
  // data.forEach(function(d) {
  //   d.date = parseDate(d.date);
  // });

  // group the data for the bars
  var bins = histogram(data);

  // Scale the range of the data in the y domain
  y.domain([0, d3.max(data, function(d) { return d.count; })]);

  // append the bar rectangles to the svg element
  svg.selectAll("rect")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", 1)
      .attr("transform", function(d) {
        return "translate(" + x(d.date) + "," + y(d.count) + ")"; })
      .attr("width", function(d) { return x(d.date); })
      .attr("height", function(d) { return height - y(d.count); });

  // add the x Axis
  svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  // add the y Axis
  svg.append("g")
      .call(d3.axisLeft(y));

}

function build_c3_multi_histogram(data){
  $('#histogram_container').empty();
  if (typeof(data.results.aggregations) === 'undefined' ||
    typeof(data.results.aggregations.date_histogram) === 'undefined' ||
    data.results.aggregations.date_histogram.buckets.length === 0) return;
  console.log('building histo with ', data);
  
  
  var div = document.createElement('div');
  div.id = 'date_histogram';
  //$(div).width('100%');
  $(div).width($('#histogram_container').width() - 10);
  
  $('#histogram_container').append(div);
  var json_data = [];
  var fields = {
    host: {}
  };
  fields['class'] = {};
  for (var i = 0, len = data.results.aggregations.date_histogram.buckets.length; i < len; i++){
    var item = data.results.aggregations.date_histogram.buckets[i];
    var to_push = {
      date: item.key
    };
  
    ['host', 'class'].forEach(function(field){
      for (var j = 0, jlen = item[field].buckets.length; j < jlen; j++){
        var subitem = item[field].buckets[j];
        //if (!subitem.doc_count) continue;
        fields[field][field + '.' + subitem.key] = 'spline';
        to_push[field + '.' + subitem.key] = subitem.doc_count;
      }
    });
    
    if (Object.keys(to_push).length < 2) continue;
    //console.log('to_push', to_push);
    json_data.push(to_push);
  }

  var combined_fields = [];
  for (var field in fields){
    for (var subfield in fields[field]){
      combined_fields.push(subfield);
    }
  }

  var chart = c3.generate({
    bindto: div,
    data: {
      json: json_data,
      keys: {
        x: 'date',
        value: combined_fields
      },
      xFormat: '%Y-%m-%dT%H:%M:%S.%LZ',
      type: 'bar',
      types: fields['host'],
      groups: [
        Object.keys(fields['host']),
        Object.keys(fields['class'])
      ]
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          format: '%Y-%m-%dT%H:%M:%S.%LZ'
        }
      }
    }
  });
}

function build_c3_histogram(data){
  if (typeof(data.results.aggregations) === 'undefined' ||
    typeof(data.results.aggregations.date_histogram) === 'undefined') return;
  console.log('building histo with ', data);
  
  
  var div = document.createElement('div');
  div.id = 'date_histogram';
  $(div).width('100%');
  $('#histogram_container').empty();
  $('#histogram_container').append(div);
  var x = ['x'], y = ['count'];
  for (var i = 0, len = data.results.aggregations.date_histogram.buckets.length; i < len; i++){
    var item = data.results.aggregations.date_histogram.buckets[i];
    console.log('bucket', item);
    x.push(new Date(item.key));
    y.push(item.doc_count);
  }
  console.log('x', JSON.stringify(x), 'y', JSON.stringify(y));
  var chart = c3.generate({
    bindto: div,
    data: {
      x: 'x',
      xFormat: '%Y-%m-%dT%H:%M:%S.%LZ',
      columns: [x, y]
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          format: '%Y-%m-%dT%H:%M:%S.%LZ'
        }
      }
    }
  });
}

function build_graph_from_hits(data){
  // data should point to results.aggregations.bucketname
  var graph = {
    nodes: [],
    links: []
  };

  // Build nodes/links
  for (var i = 0, len = data.length; i < len; i++){
    for (var j = 0, jlen = data[i].keys.length; j < jlen - 1; j++){
      var src = data[i].keys[j];
      var dst = data[i].keys[j + 1];
      graph.links.push({
        source: data[i].keys[j],
        target: data[i].keys[j + 1],
        value: data[i].doc_count
      });
      // var src_id = add_node(graph, src);
      // var dst_id = add_node(graph, dst);
      // add_link(graph, src_id, dst_id, data[i].doc_count); 
    }
  }

  // Add in nodes
  for (var i = 0, len = graph.links.length; i < len; i++){
    var found = false;
    for (var j = 0, jlen = graph.nodes.length; j < jlen; j++){
      if (graph.nodes[j].name === graph.links[i].source){
        found = true;
        break;
      }
    }
    if (!found){
      //console.log('Did not find ' + graph.links[i].source);
      graph.nodes.push({name: graph.links[i].source});
    }

    found = false;
    for (var j = 0, jlen = graph.nodes.length; j < jlen; j++){
      if (graph.nodes[j].name === graph.links[i].target){
        found = true;
        break;
      }
    }
    if (!found){
      //console.log('Did not find ' + graph.links[i].target);
      graph.nodes.push({name: graph.links[i].target});
    }
  }

  return graph;
}

function build_sankey(graph){
  var units = "Count";
 
  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = $('#viz_container').width() - margin.left - margin.right,
      height = $('#viz_container').height() - margin.top - margin.bottom;
  console.log('width', width, 'height', height);
   
  var formatNumber = d3.format(",.0f"),    // zero decimal places
      format = function(d) { return formatNumber(d) + " " + units; },
      //color = d3.scaleOrdinal(d3.schemeCategory20);
      color = d3.scale.category20();

  // var el = document.createElement('div');
  // el.id = 'chart';
  // $('body').append(el);
   
  // append the svg canvas to the page
  $("#viz_container").empty();
  var svg = d3.select("#viz_container").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", 
            "translate(" + margin.left + "," + margin.top + ")");
   
  // Set the sankey diagram properties
  var sankey = d3.sankey()
      .nodeWidth(36)
      .nodePadding(10)
      .size([width, height]);
   
  var path = sankey.link();
   
  
   
  var nodeMap = {};
  graph.nodes.forEach(function(x) { nodeMap[x.name] = x; });
  graph.links = graph.links.map(function(x) {
    return {
      source: nodeMap[x.source],
      target: nodeMap[x.target],
      value: x.value
    };
  });

  console.log('graph', graph);

  sankey
    .nodes(graph.nodes)
    .links(graph.links)
    .layout(32);
  console.log('graph.links', graph.links);

  // add in the links
  var link = svg.append("g").selectAll(".link")
      .data(graph.links)
    .enter().append("path")
      .attr("class", "link")
      .attr("d", path)
      .style("stroke-width", function(d) { return Math.max(1, d.dy); })
      .sort(function(a, b) { return b.dy - a.dy; });

  // add the link titles
  link.append("title")
    .text(function(d) {
      return d.source.name + " → " + d.target.name + "\n" + format(d.value); 
    });

  // add in the nodes
  var node = svg.append("g").selectAll(".node")
      .data(graph.nodes)
    .enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { 
      return "translate(" + d.x + "," + d.y + ")"; })
    //.call(d3.drag()
    //  .subject(function(d) { return d; })
    //.on("start", function() {
    // this.parentNode.appendChild(this); })
    // .on("drag", dragmove));
    .call(d3.behavior.drag()
      .origin(function(d) { return d; })
      .on("dragstart", function() {
      this.parentNode.appendChild(this); })
      .on("drag", dragmove));

  // add the rectangles for the nodes
  node.append("rect")
    .attr("height", function(d) { return d.dy; })
    .attr("width", sankey.nodeWidth())
    .style("fill", function(d) { 
      return d.color = color(d.name.replace(/ .*/, "")); })
    .style("stroke", function(d) { 
      return d3.rgb(d.color).darker(2); })
    .append("title").text(function(d) { 
      return d.name + "\n" + format(d.value); 
    });

  // add in the title for the nodes
  node.append("text")
    .attr("x", -6)
    .attr("y", function(d) { return d.dy / 2; })
    .attr("dy", ".35em")
    .attr("text-anchor", "end")
    .attr("transform", null)
      .text(function(d) { return d.name; })
    .filter(function(d) { return d.x < width / 2; })
    .attr("x", 6 + sankey.nodeWidth())
    .attr("text-anchor", "start");

  $.contextMenu({
    selector: '#viz_container rect',
    callback: handle_context_menu_callback,
    items: CONTEXT_MENU_ITEMS/*{
      pivot: {name: 'Pivot', icon: function(){ return 'fa fa-level-down fa-fw'} },
      sep: '-----',
      scope: {name: 'Scope', icon: function(){ return 'fa fa-binoculars fa-fw'} },
      sep1: '-----',
      note: {name: 'Note', icon: function(){ return 'fa fa-comment fa-fw'} },
      sep2: '-----',
      tag: {name: 'Tag', icon: function(){ return 'fa fa-hashtag fa-fw'} },
      sep3: '-----',
      favorite: {name: 'Favorite', icon: function(){ return 'fa fa-star fa-fw'} },
    }*/
  });

  // the function for moving the nodes
  function dragmove(d) {
    d3.select(this).attr("transform", 
        "translate(" + (
             d.x = Math.max(0, Math.min(width - d.dx, d3.event.x))
          ) + "," + (
                   d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
            ) + ")");
    sankey.relayout();
    link.attr("d", path);
  }
}

function make_two_dimensional(records){
  // Given an array of records, return two dimensions.
  // The first is total bytes, the second is total fields.
  var nodes = [];
  var max_height = 25;
  var max_width = 25;
  // Find max values

  var top_height = 0;
  var top_width = 0;
  for (var i = 0, len = records.length; i < len; i++){
    records[i].height = Object.keys(records[i]._source).length;
    if (records[i].height > top_height) top_height = records[i].height;
    records[i].width = JSON.stringify(records[i]._source).length;
    if (records[i].width > top_width) top_width = records[i].width;
  }
  console.log('top', top_height, top_width);
  // Go through and adjust based on max values
  for (var i = 0, len = records.length; i < len; i++){
    console.log(records[i].height, max_height, (records[i].height / top_height), max_height * (records[i].height / top_height))
    records[i].height = max_height * (records[i].height / top_height);
    records[i].width = max_width * (records[i].width / top_width);
    nodes.push(records[i]);
  }
  return nodes;
}

var display_fields = [
  '@timestamp',
  'program',
  'host',
  'class',
  'srcip', 
  'dstip', 
  'src_geo.country',
  'dst_geo.country',
  'proto',
  'srcport',
  'dstport',
  'md5',
  'user',
  'site',
  'domain',
  'rxhosts',
  'txhosts',
  'uri',
  'status_code',
  'user_agent',
  '@message'
];

var similarity_fields = [
  'srcip', 
  'dstip', 
  'src_geo.country',
  'dst_geo.country',
  'srcport',
  'dstport',
  'md5',
  'user',
  'site',
  'domain',
  'rxhosts',
  'txhosts',
  'uri',
  'status_code',
  'user_agent',
  '@message'
];

function build_links(nodes, d){
  // Find the nodes index of d
  var d_index = null;
  for (var i = 0, len = nodes.length; i < len; i++){
    if (d._id === nodes[i]._id){
      d_index = i;
      break;
    }
  }
  var links = [];
  for (var i = 0, len = nodes.length; i < len; i++){
    if (d._id === nodes[i]._id) continue;
    for (var d_field in d._source){
      if (similarity_fields.indexOf(d_field) < 0) continue
      for (var n_field in nodes[i]._source){
        if (d_field === n_field && d._source[d_field] === nodes[i]._source[n_field]){
          var found = false;
          for (var j = 0, jlen = links.length; j < jlen; j++){
            if (links[j].source === d_index && links[j].target === i){
              found = true;
              links[j].value++;
              links[j].fields.push(d_field);
              break;
            }
          }
          if (!found)
            links.push({source:d_index, target:i, value:1, fields:[d_field]});
        }
      }
    }
  }
  // Now go thorugh each link and report on how common the link is. If this links to everybody,
  // this is isn't relevant.
  var report = {};
  for (var i = 0, len = links.length; i < len; i++){
    for (var j = 0, jlen = links[i].fields.length; j < jlen; j++){
      var field = links[i].fields[j];
      if (typeof(report[field]) === 'undefined')
        report[field] = 1;
      else
        report[field]++;
    }
  }
  //console.log('report', report);
  //console.log('before pruning', JSON.stringify(links.slice(0,2)));
  var margin = .5;
  
  for (var field in report){
    if (report[field] >= margin * nodes.length){
      console.log('determined that field ' + field + 
        ' is too common at count ' + report[field]);
      var i = links.length;
      while (i--){
        if (links[i].fields.indexOf(field) > -1){
          links[i].value--;
        }
      }
    }
  }

  var ret = [];
  for (var i = 0, len = links.length; i < len; i++){
    if (links[i].value) ret.push(links[i]);
  }

  return ret;
}

function force_rectangles(results){
  console.log('results.hits.hits', results.hits.hits);
  var nodes = make_two_dimensional(results.hits.hits);
  var start = new Date();
  var max_links = 0;
  for (var i = 0, len = nodes.length; i < len; i++){
    var node_links = build_links(nodes, nodes[i]);
    console.log('node', i, 'link', node_links.length);
    nodes[i].links = node_links;
    if (node_links.length > max_links)
      max_links = node_links.length;
  }
  console.log('took', new Date().getTime() - start.getTime());
  var links = []; // will dynamically add later
  console.log('nodes', nodes);
  var units = "Count";
 
  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = $('#viz_container').width() - margin.left - margin.right,
      height = $('#viz_container').height() - margin.top - margin.bottom;
  console.log('width', width, 'height', height);
   
  var formatNumber = d3.format(",.0f"),    // zero decimal places
      format = function(d) { return formatNumber(d) + " " + units; },
      //color = d3.scaleOrdinal(d3.schemeCategory20);
      color = d3.scale.category20();

  // var el = document.createElement('div');
  // el.id = 'chart';
  // $('body').append(el);

  // append the svg canvas to the page
  $("#viz_container").empty();
  var event_div = document.createElement('div');
  event_div.id = 'event_fields';
  $("#viz_container").append(event_div);
  var svg = d3.select("#viz_container").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg.append("text").attr('class', 'display_banner')
    .attr('x', margin.left)
    .attr('y', margin.top * 2);

  var force = d3.layout.force()
    //.gravity(0.05)
    .charge(-50)
    //.charge(function(d, i) { return i ? -30 : -2000; })
    .size([width, height])
  force
    .links(links)
    .nodes(nodes)
    .start();
   
  var node = svg.selectAll(".node")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    // .attr("transform", 
    //   "translate(" + margin.left + "," + margin.top + ")")
    .call(force.drag);

  var link = svg.selectAll(".link")
    .attr("class", "link");

  node
    .append('rect')
    //.attr('width', function(d) { return d.width; })
    .attr('width', function(d) { return 25 * (d.links.length / max_links); })
    .attr('height', function(d) { return d.height; })
    .attr('destination_x', function(d){ return Math.random() * width })
    .attr('label', function(d){ return d._source['@message']})
    // .on('mouseover', function(d){
    //   //d3.select('.display_banner').text(d._source['@message']);
    //   $('#event_fields').empty();
    //   var table = document.createElement('table');
    //   var tbody = document.createElement('tbody');
    //   table.appendChild(tbody);
    //   for (var i = 0, len = display_fields.length; i < len; i++){
    //     if (typeof(d._source[ display_fields[i] ]) === 'undefined') continue;
    //     var tr = document.createElement('tr');
    //     var td = document.createElement('td');
    //     $(td).text(display_fields[i]);
    //     tr.appendChild(td);
    //     td = document.createElement('td');
    //     $(td).text(d._source[ display_fields[i] ]);
    //     tr.appendChild(td);
    //     tbody.appendChild(tr);
    //   }
    //   tr = document.createElement('tr');
    //   td = document.createElement('td');
    //   $(td).text('links');
    //   tr.appendChild(td);
    //   td = document.createElement('td');
    //   $(td).text(JSON.stringify(d.links));
    //   tr.appendChild(td);
    //   tbody.appendChild(tr);
    //   $('#event_fields').append(table);
    // })
    // .on('mouseout', function(d){
    //   //d3.select('.display_banner').text('');
    //   $('#event_fields').empty();
    // })
    .on('click', function(d){
      links = build_links(nodes, d);
      //links = d.links;
      console.log('links', links);
      force.links(links);
      link = link.data(force.links(), function(d) { return d.source + "-" + d.target; });
      link.enter().insert("line", ".node").attr("class", "link");
      link.exit().remove();
      console.log('link', link);
      force.start();
      // link = svg.selectAll(".link")
      //   .data(links)
      //   .enter().append("line")
      //   .attr("class", "link");
    })
    .style('fill', function(d, i) { return color(d._source['class']); })
    .attr('transform', function(d) { return 'translate(' + (-d.width / 2) + 
      ',' + (-d.height / 2) + ')'; })
  
    

  // node.append('text')
  //   .text(function(d){ return d._source['@message']})
  //   .style({opacity:0.0})
  var min_timestamp = new Date().getTime() / 1000;
  var max_timestamp = 0;
  nodes.forEach(function(o){
    var ts = moment(o._source['@timestamp']).unix();
    console.log('ts', ts, o._source['@timestamp'], o._source['orig_@timestamp']);
    if (ts > max_timestamp)
      max_timestamp = ts;
    if (ts < min_timestamp)
      min_timestamp = ts;
  });
  var ts_scale = max_timestamp - min_timestamp;
  console.log('ts_scale', ts_scale);
  nodes.forEach(function(o){
    //o.destination_x = Math.random() * width;
    var ts = moment(o._source['@timestamp']).unix();
    if (ts_scale){
      ts = moment(o._source['@timestamp']).unix() - min_timestamp;
      o.destination_x = width * ts / ts_scale;
      o.destination_y = Math.random() * height * .1;
    }
    else {
      ts = moment(o._source['@timestamp']).unix() - min_timestamp;
      o.destination_x = Math.random() * width;
      o.destination_y = Math.random() * height * .1; 
    }
  });

  force.on('tick', function(e) {
    var k = e.alpha * .1;

    nodes.forEach(function(o){
      o.y += (o.destination_y - o.y) * k;
      o.x += (o.destination_x - o.x) * k;
    });
    svg.selectAll('rect')
      .attr('x', function(d) { return d.x; })
      .attr('y', function(d) { return d.y; });

    link.attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
    
    // svg.selectAll('text')
    //   .attr('x', function(d) { return d.x; })
    //   .attr('y', function(d) { return d.y; });
  });

  force.start();

  function collide(node) {
    return function(quad, x1, y1, x2, y2) {
      var updated = false;
      if (quad.point && (quad.point !== node)) {

        var x = node.x - quad.point.x,
          y = node.y - quad.point.y,
          xSpacing = (quad.point.width + node.width) / 2,
          ySpacing = (quad.point.height + node.height) / 2,
          absX = Math.abs(x),
          absY = Math.abs(y),
          l,
          lx,
          ly;

        if (absX < xSpacing && absY < ySpacing) {
          l = Math.sqrt(x * x + y * y);

          lx = (absX - xSpacing) / l;
          ly = (absY - ySpacing) / l;

          // the one that's barely within the bounds probably triggered the collision
          if (Math.abs(lx) > Math.abs(ly)) {
            lx = 0;
          } else {
            ly = 0;
          }

          node.x -= x *= lx;
          node.y -= y *= ly;
          quad.point.x += x;
          quad.point.y += y;

          updated = true;
        }
      }
      return updated;
    };
  }

}