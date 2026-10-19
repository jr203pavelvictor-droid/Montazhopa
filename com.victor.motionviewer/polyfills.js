/* CEP 10 / Chromium 74 compatibility. */
(function(){if(!Element.prototype.replaceChildren){Element.prototype.replaceChildren=function(){while(this.firstChild)this.removeChild(this.firstChild);for(var i=0;i<arguments.length;i++)this.appendChild(typeof arguments[i]==='string'?document.createTextNode(arguments[i]):arguments[i]);};}}());
