'use strict';

/* Filters */

var ndpPerformanceDataEntryFilters = angular.module('ndpPerformanceDataEntryFilters', [])

.filter('fileSize', function(){
    return function(bytes){

        if(!bytes ){
            return;
        }        
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    };
})

.filter('documentFilter', function(){
    return function(data, folder, programme, programmeDataElement){
        if(!data ){
            return;
        }

        if(!folder){
            return data;
        }
        else{
            return data.filter(function(item){
                var f = false, p = true;
                if( item.folder ) f = item.folder.indexOf(folder) > -1;
                if( programme && item[programmeDataElement.id] ){
                    p = item[programmeDataElement.id].indexOf(programme.displayName) > -1;
                }
                return f && p;
            });
        }
    };
})

.filter('getFirst', function(){
    return function(data, obj){
        if(!data ){
            return;
        }
        if(!obj){
            return data;
        }
        else{
            var res = data.filter(function(item){
                var match = true;
                for( var k in obj ){
                    match = match && item[k] === obj[k];
                    if( !match ){
                        return match;
                    }
                }
                return match;
            });
            if(res && res.length > 0){
                return res[0];
            }
            return null;
        }
    };
})

.filter('startsWith', function(){
    return function(data, obj){
        if(!data ){
            return;
        }
        if(!obj){
            return data;
        }
        else{
            return data.filter(function(item){
                var match = true;
                for( var k in obj ){
                    if ( item[k] && obj && obj[k] ){
                        match = match && item[k].toLowerCase().indexOf(obj[k].toLowerCase()) === 0;
                    }
                    if( !match ){
                        return match;
                    }
                }
                return match;
            });
        }
    };
});