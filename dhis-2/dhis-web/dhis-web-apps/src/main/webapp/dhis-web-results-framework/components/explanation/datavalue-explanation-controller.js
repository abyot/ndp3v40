/* Controllers */

/* global ndpFramework */

ndpFramework.controller('DataValueExplanationController',
    function($scope,
            $modalInstance,
            $filter,
            $window,
            DHIS2URL,
            item,
            DataValueService,
            DocumentService,
            MetaDataFactory){


    $scope.selectedItem = {};
    $scope.fetchExplanation = true;
    $scope.categoryCombosById = [];
    $scope.dataPeriods = [];
    $scope.dataVotes = [];
    $scope.votesById = {};

    if ( !item || !item.details || !item.period || !item.aoc || !item.coc ){
        $scope.fetchExplanation = false;
    }
    else{
        $scope.dataElementId = item.details;
        $scope.period = item.period;
        $scope.aoc = item.aoc;
        $scope.coc = item.coc;

        $scope.selectedItem = {
            dataElementId: item.details,
            period: item.period,
            aoc: item.aoc,
            coc: item.coc.id
        };

        MetaDataFactory.getAll('categoryCombos').then(function(categoryCombos){
            angular.forEach(categoryCombos, function(cc){
                $scope.categoryCombosById[cc.id] = cc;
            });
            MetaDataFactory.getAll('dataSets').then(function(dataSets){

                angular.forEach(dataSets, function(ds){
                    ds.dataElements = ds.dataElements.map(function(de){ return de.id; });
                });

                MetaDataFactory.getAll('dataElements').then(function(dataElements){
                    for( var j=0; j<dataElements.length; j++){
                        var de = dataElements[j];
                        if ( de.id === $scope.selectedItem.dataElementId ){
                            de.votes = [];
                            de.periodTypes = [];
                            de.dataSets = [];

                            de.decc = $scope.categoryCombosById[de.categoryCombo.id];
                            for( var k=0; k<de.decc.categoryOptionCombos.length; k++ ){
                                if ( de.decc.categoryOptionCombos[k].id === $scope.selectedItem.coc ){
                                    $scope.selectedCoc = de.decc.categoryOptionCombos[k];
                                    break;
                                }
                            }

                            for(var i=0; i<dataSets.length; i++){
                                var ds = dataSets[i];
                                if( ds && ds.dataElements.indexOf(de.id) !== -1 ){
                                    de.dscc = $scope.categoryCombosById[ds.categoryCombo.id];
                                    for( var l=0; l<de.dscc.categoryOptionCombos.length; l++ ){
                                        var opts = $.map(de.dscc.categoryOptionCombos[l].categoryOptions, function(op){return op.id;});
                                        if ( opts.indexOf($scope.selectedItem.aoc) !== -1 ){
                                            $scope.selectedAoc = de.dscc.categoryOptionCombos[l];
                                            break;
                                        }
                                    }

                                    if( de.periodTypes.indexOf(ds.periodType) === -1){
                                        de.periodTypes.push(ds.periodType);
                                    }
                                    angular.forEach(ds.organisationUnits, function(ou){
                                        $scope.votesById[ou.id] = ou;
                                        if(de.votes.indexOf(ou.id) === -1){
                                            de.votes.push(ou.id);
                                        }
                                    });
                                    de.dataSets.push( ds.id );
                                }
                            }

                            if ( de.decc.isDefault ){
                                $scope.selectedItem.displayName = de.displayName;
                            }
                            else{
                                $scope.selectedItem.displayName = de.displayName + ' - ' + $scope.selectedCoc.displayName;
                            }

                            $scope.selectedItem.dscc = de.dscc;
                            $scope.selectedItem.orgUnits = de.votes;
                            $scope.selectedItem.dataSets = de.dataSets;
                            $scope.selectedItem.periodTypes = de.periodTypes;

                            break;
                        }
                    }

                    var dataValueSetUrl = 'dataSet=' + $scope.selectedItem.dataSets.join(',');
                    dataValueSetUrl += '&orgUnit=' + $scope.selectedItem.orgUnits.join(',');
                    dataValueSetUrl += '&startDate=' + $scope.period.startDate;
                    dataValueSetUrl += '&endDate='  + $scope.period.endDate;

                    var pushedVotes = [];
                    var pushedPeriods = [];
                    DataValueService.getDataValueSet( dataValueSetUrl ).then(function( response ){
                        if( response.dataValues && response.dataValues.length > 0 ){
                            var params = {
                                dataElement: $scope.selectedItem.dataElementId,
                                categoryOptionCombo: $scope.selectedCoc.id
                            };

                            if ( $scope.selectedAoc && $scope.selectedAoc.id){
                                params.attributeOptionCombo = $scope.selectedAoc.id;
                            }

                            $scope.dataValues = $filter('filter')(response.dataValues, params);

                            var eventIds = [];

                            angular.forEach($scope.dataValues, function(dv){
                                if ( dv.comment ){
                                    dv.comment = JSON.parse( dv.comment );

                                    if ( dv.comment.attachment ){
                                        angular.forEach(dv.comment.attachment, function(att){
                                            eventIds.push( att );
                                        });
                                    };
                                }

                                if ( pushedVotes.indexOf( dv.orgUnit ) === -1 ){
                                    pushedVotes.push( dv.orgUnit );
                                    $scope.dataVotes.push( $scope.votesById[dv.orgUnit] );
                                }
                                if ( pushedPeriods.indexOf(dv.period) === -1){
                                    pushedPeriods.push( dv.period );
                                    $scope.dataPeriods.push( {id: dv.period, name: dv.period} );
                                }
                            });

                            $scope.documents = {};
                            if ( eventIds.length > 0 ){
                                DocumentService.getMultiple( eventIds ).then(function(docs){
                                    $scope.documents = docs;
                                });
                            }
                        }
                    });
                });
            });
        });
    }

    $scope.downloadFile = function(path, e){
        if( path ){
            $window.open(DHIS2URL + path, '_blank', '');
        }
        if(e){
            e.stopPropagation();
            e.preventDefault();
        }
    };

    $scope.close = function () {
        $modalInstance.close();
    };
});