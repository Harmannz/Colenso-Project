function convertToHierarchy(rootNode, arry /* array of array of strings */)
{
    
    for (var i = 0; i < arry.length; i++)
    {
        var path = arry[i];
        buildNodeRecursive(rootNode, path, 0);
    }
    return rootNode;
}

function buildNodeRecursive(node, path, idx)
{
    if (idx < path.length)
    {
        item = path[idx];
		
        if (!node.children[item])
        {
            node.children[item] = {children:{}, count:0, 'path':"/" + path.join('/')};
        }
		node.path = "/" + path.slice(0,idx).join("/");
		node.count = Object.keys(node.children).length;
		
        buildNodeRecursive(node.children[item], path, idx + 1);
    }

}
module.exports.convertToHierarchy = convertToHierarchy;