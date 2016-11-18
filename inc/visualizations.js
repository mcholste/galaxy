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