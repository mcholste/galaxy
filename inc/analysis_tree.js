function AnalysisTree(){
  var self = this;
  self.tree = {
    name: '',
    data: {},
    children: [],
    parent: null
  };
  self.last = self.tree;
}
AnalysisTree.prototype.propagate = function(scope, data, branch){
  var self = this;
  var node = {
    name: scope,
    data: data,
    children: []
  };
  if (branch){
    // get parent
    console.log('last', self.last);
    if (self.last.parent){
      var parent = self.last.parent;
      node.parent = parent;
      parent.children.push(node);
    }
    else {
      node.parent = self.tree;
      self.tree.children.push(node);
    }
  }
  else {
    // Link to previous
    node.parent = self.last;
    self.last.children.push(node);
  }
  self.last = node;
  console.log(self.tree);
};

AnalysisTree.prototype.visualize = function(dom_element){
  var self = this;
  function clean_data(data){
    delete data.data;
    delete data.parent;
    for (var i = 0, len = data.children.length; i < len; i++){
      clean_data(data.children[i]);
    }
    return data;
  }
  var data = clean_data(_.cloneDeep(self.tree));
  
  console.log('clean data', data);
  $(dom_element).empty();
  var margin = {top: 20, right: 190, bottom: 30, left: 190},
  width = 660 - margin.left - margin.right,
  height = 500 - margin.top - margin.bottom;

  // declares a tree layout and assigns the size
  var treemap = d3.tree()
  .size([height, width]);

  //  assigns the data to a hierarchy using parent-child relationships
  var nodes = d3.hierarchy(data, function(d) {
    return d.children;
    });

  // maps the node data to the tree layout
  nodes = treemap(nodes);

  // append the svg object to the body of the page
  // appends a 'group' element to 'svg'
  // moves the 'group' element to the top left margin
  var svg = d3.select(dom_element).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom),
    g = svg.append("g")
      .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

  // adds the links between the nodes
  var link = g.selectAll(".link")
    .data( nodes.descendants().slice(1))
    .enter().append("path")
    .attr("class", "link")
    .attr("d", function(d) {
       return "M" + d.y + "," + d.x
       + "C" + (d.y + d.parent.y) / 2 + "," + d.x
       + " " + (d.y + d.parent.y) / 2 + "," + d.parent.x
       + " " + d.parent.y + "," + d.parent.x;
       });

  // adds each node as a group
  var node = g.selectAll(".node")
    .data(nodes.descendants())
    .enter().append("g")
    .attr("class", function(d) { 
      return "node" + 
      (d.children ? " node--internal" : " node--leaf"); })
    .attr("transform", function(d) { 
      return "translate(" + d.y + "," + d.x + ")"; });

  // adds the circle to the node
  node.append("circle")
    .attr("r", 2.5);

  var last_pos = false;
  // adds the text to the node
  node.append("text")
    .attr("dy", 3)
    .attr("y", function(d) { 
      if (last_pos){ last_pos = false; return 13 } 
      else { last_pos = true; return -13 } })
    .attr("x", function(d) { return d.children ? -13 : 13; })
    .style("text-anchor", function(d) { 
      return d.children ? "end" : "start"; })
    .text(function(d) { return d.data.name; });

}